// automation.repository.ts => flujos y ejecuciones en MongoDB (Mongoose). Patrón Repository: el service no ve Mongoose.
import { Types } from "mongoose";
import { WorkflowModel, WorkflowRunModel, WorkflowVersionModel, type AutomationEvent, type RunStatus, type TriggerType } from "../model/automation.model";
import type { AutomationHealthDto, ExecutionStatusDto, WorkflowDto, WorkflowHealthDto, WorkflowMetricsDto, WorkflowVersionDto } from "../dto/automation.dto";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";
import { percentile } from "../../../shared/util/stats.util";
export { percentile }; // Re-exportada: la usan las pruebas del RF-20.7

export type WorkflowRow = Omit<WorkflowDto, "metrics">;
export type WorkflowWrite = Partial<Pick<WorkflowRow, "name" | "description" | "triggerType" | "event" | "webhookPath" | "n8nWorkflowId" | "active">>;

const METRICS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // Métricas de salud: últimos 30 días
export const EMPTY_METRICS: WorkflowMetricsDto = { runs: 0, successRate: 0, avgDurationMs: 0 };

export class AutomationRepository {
  public async create(data: WorkflowWrite & Pick<WorkflowRow, "name" | "triggerType" | "webhookPath"> & { createdBy: string }): Promise<WorkflowRow> {
    return toWorkflow(await WorkflowModel.create(data));
  }

  public async findMany(page: PageParams): Promise<Paginated<WorkflowRow>> {
    const [docs, total] = await Promise.all([WorkflowModel.find().sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).lean(), WorkflowModel.countDocuments()]);
    return { items: docs.map(toWorkflow), total };
  }

  public async findById(id: string): Promise<WorkflowRow | null> {
    const doc = await WorkflowModel.findById(id).lean();
    return doc ? toWorkflow(doc) : null;
  }

  // findActiveByEvent => flujos a disparar cuando ocurre un evento de dominio (usa el índice compuesto)
  public async findActiveByEvent(event: AutomationEvent): Promise<WorkflowRow[]> {
    return (await WorkflowModel.find({ active: true, triggerType: "EVENT", event }).lean()).map(toWorkflow);
  }

  // snapshot => RF-20.7 guarda la versión actual antes de modificarla (historial auditable)
  public async snapshot(row: WorkflowRow, changedBy: string): Promise<void> {
    const { name, description, triggerType, event, webhookPath, active } = row;
    await WorkflowVersionModel.create({ workflowId: row.id, version: row.version, snapshot: { name, description, triggerType, event, webhookPath, active }, changedBy });
  }

  public async versions(workflowId: string): Promise<WorkflowVersionDto[]> {
    const docs = await WorkflowVersionModel.find({ workflowId }).sort({ version: -1 }).limit(50).lean();
    return docs.map((doc) => ({ version: doc.version, snapshot: doc.snapshot as Record<string, unknown>, changedBy: doc.changedBy, createdAt: doc.createdAt ?? new Date() }));
  }

  // health => RF-20.7 tablero de salud: por flujo (éxito, fallos, duración media y p95, último error) + serie diaria.
  // Dos agregaciones en paralelo; el p95 se calcula con $percentile (MongoDB 7) o, si no existe, con el máximo
  public async health(days: number): Promise<AutomationHealthDto> {
    const since = new Date(Date.now() - days * 86_400_000);
    const [perWorkflow, timeline, workflows] = await Promise.all([
      WorkflowRunModel.aggregate<{ _id: Types.ObjectId; runs: number; success: number; failed: number; running: number; avg: number | null; durations: number[]; lastError: string | null; lastAt: Date | null }>([
        { $match: { createdAt: { $gte: since } } },
        { $sort: { createdAt: 1 } },
        {
          $group: {
            _id: "$workflowId",
            runs: { $sum: 1 },
            success: { $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] } },
            running: { $sum: { $cond: [{ $eq: ["$status", "RUNNING"] }, 1, 0] } },
            avg: { $avg: "$durationMs" },
            durations: { $push: "$durationMs" },
            lastError: { $last: "$error" },
            lastAt: { $last: "$createdAt" },
          },
        },
      ]),
      WorkflowRunModel.aggregate<{ _id: string; success: number; failed: number }>([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, success: { $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] } }, failed: { $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] } } } },
        { $sort: { _id: 1 } },
      ]),
      WorkflowModel.find().select({ name: 1, active: 1, version: 1, lastRunAt: 1 }).lean(),
    ]);
    const stats = new Map(perWorkflow.map((row) => [String(row._id), row]));
    const rows: WorkflowHealthDto[] = workflows.map((workflow) => {
      const row = stats.get(String(workflow._id));
      const runs = row?.runs ?? 0;
      const finished = (row?.success ?? 0) + (row?.failed ?? 0);
      const successRate = finished ? Number(((row?.success ?? 0) / finished).toFixed(4)) : 0;
      return {
        workflowId: String(workflow._id),
        name: workflow.name,
        active: workflow.active ?? true,
        version: workflow.version ?? 1,
        runs,
        success: row?.success ?? 0,
        failed: row?.failed ?? 0,
        running: row?.running ?? 0,
        successRate,
        avgDurationMs: Math.round(row?.avg ?? 0),
        p95DurationMs: percentile(row?.durations ?? [], 0.95),
        lastRunAt: workflow.lastRunAt ?? null,
        lastError: row?.lastError ?? null,
        health: classifyHealth(finished, successRate),
      };
    });
    const success = rows.reduce((sum, row) => sum + row.success, 0);
    const failed = rows.reduce((sum, row) => sum + row.failed, 0);
    const allDurations = perWorkflow.flatMap((row) => row.durations);
    return {
      days,
      totals: { runs: rows.reduce((sum, row) => sum + row.runs, 0), success, failed, successRate: success + failed ? Number((success / (success + failed)).toFixed(4)) : 0, avgDurationMs: allDurations.length ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length) : 0 },
      timeline: timeline.map((row) => ({ day: row._id, success: row.success, failed: row.failed })),
      workflows: rows.sort((a, b) => a.successRate - b.successRate),
    };
  }

  // update => "$set" parcial + "$inc" de la versión (historial simple de cambios)
  public async update(id: string, changes: WorkflowWrite): Promise<WorkflowRow | null> {
    const doc = await WorkflowModel.findByIdAndUpdate(id, { $set: changes, $inc: { version: 1 } }, { new: true }).lean();
    return doc ? toWorkflow(doc) : null;
  }

  // delete => borra el flujo y su bitácora ("eliminar workflow y sus ejecuciones")
  public async delete(id: string): Promise<void> {
    await Promise.all([WorkflowModel.deleteOne({ _id: id }), WorkflowRunModel.deleteMany({ workflowId: id })]);
  }

  public async createRun(workflowId: string, trigger: TriggerType): Promise<ExecutionStatusDto> {
    return toRun(await WorkflowRunModel.create({ workflowId, trigger, status: "RUNNING" }));
  }

  // finishRun => cierra la ejecución y marca la fecha de última ejecución del flujo (dos escrituras en paralelo)
  public async finishRun(run: ExecutionStatusDto, result: { status: RunStatus; attempts: number; durationMs: number; httpStatus: number | null; error: string | null }): Promise<void> {
    const finishedAt = new Date();
    await Promise.all([
      WorkflowRunModel.updateOne({ _id: run.id }, { $set: { ...result, finishedAt } }),
      WorkflowModel.updateOne({ _id: run.workflowId }, { $set: { lastRunAt: finishedAt } }),
    ]);
  }

  public async recentRuns(workflowId: string, limit = 20): Promise<ExecutionStatusDto[]> {
    return (await WorkflowRunModel.find({ workflowId }).sort({ createdAt: -1 }).limit(limit).lean()).map(toRun);
  }

  // metrics => UNA agregación para todos los flujos de la página (sin N+1): ejecuciones, éxito y duración media
  public async metrics(workflowIds: string[]): Promise<Map<string, WorkflowMetricsDto>> {
    if (workflowIds.length === 0) return new Map();
    const rows = await WorkflowRunModel.aggregate<{ _id: Types.ObjectId; runs: number; ok: number; avg: number | null }>([
      { $match: { workflowId: { $in: workflowIds.map((id) => new Types.ObjectId(id)) }, createdAt: { $gte: new Date(Date.now() - METRICS_WINDOW_MS) } } },
      { $group: { _id: "$workflowId", runs: { $sum: 1 }, ok: { $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] } }, avg: { $avg: "$durationMs" } } },
    ]);
    return new Map(rows.map((row) => [String(row._id), { runs: row.runs, successRate: row.runs > 0 ? Number((row.ok / row.runs).toFixed(4)) : 0, avgDurationMs: Math.round(row.avg ?? 0) }]));
  }
}

// classifyHealth => sin ejecuciones IDLE; >= 95 % HEALTHY; >= 80 % DEGRADED; menos FAILING (función pura)
export function classifyHealth(finished: number, successRate: number): WorkflowHealthDto["health"] {
  if (finished === 0) return "IDLE";
  return successRate >= 0.95 ? "HEALTHY" : successRate >= 0.8 ? "DEGRADED" : "FAILING";
}

// --- Mapeadores documento -> fila (ObjectId expuesto como string) ---

function toWorkflow(doc: {
  _id: unknown;
  name: string;
  description?: string | null | undefined;
  triggerType: string;
  event?: string | null | undefined;
  webhookPath: string;
  n8nWorkflowId?: string | null | undefined;
  active?: boolean | null | undefined;
  version?: number | null | undefined;
  lastRunAt?: Date | null | undefined;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}): WorkflowRow {
  return {
    id: String(doc._id),
    name: doc.name,
    description: doc.description ?? null,
    triggerType: doc.triggerType as TriggerType,
    event: (doc.event ?? null) as AutomationEvent | null,
    webhookPath: doc.webhookPath,
    n8nWorkflowId: doc.n8nWorkflowId ?? null,
    active: doc.active ?? true,
    version: doc.version ?? 1,
    lastRunAt: doc.lastRunAt ?? null,
    createdAt: doc.createdAt ?? new Date(),
    updatedAt: doc.updatedAt ?? new Date(),
  };
}

function toRun(doc: {
  _id: unknown;
  workflowId: unknown;
  trigger: string;
  status?: string | null | undefined;
  attempts?: number | null | undefined;
  durationMs?: number | null | undefined;
  httpStatus?: number | null | undefined;
  error?: string | null | undefined;
  createdAt?: Date | undefined;
  finishedAt?: Date | null | undefined;
}): ExecutionStatusDto {
  return {
    id: String(doc._id),
    workflowId: String(doc.workflowId),
    trigger: doc.trigger as TriggerType,
    status: (doc.status ?? "RUNNING") as RunStatus,
    attempts: doc.attempts ?? 0,
    durationMs: doc.durationMs ?? 0,
    httpStatus: doc.httpStatus ?? null,
    error: doc.error ?? null,
    createdAt: doc.createdAt ?? new Date(),
    finishedAt: doc.finishedAt ?? null,
  };
}

export const automationRepository = new AutomationRepository();
