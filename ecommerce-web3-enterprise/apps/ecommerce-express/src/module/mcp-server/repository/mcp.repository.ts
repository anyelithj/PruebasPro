// mcp.repository.ts => transacciones MCP en MongoDB (Mongoose). Patrón Repository + implementación del SagaJournal
// (el orquestador guarda el avance de cada paso sin conocer Mongoose: DIP).
import { McpTransactionModel, type StepStatus, type TransactionStatus } from "../model/mcp.model";
import type { SagaStepDto, TransactionDto } from "../dto/mcp.dto";
import type { SagaJournal } from "../saga/mcp.saga";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";

export class McpRepository {
  public async create(data: { type: string; steps: SagaStepDto[]; idempotencyKey?: string | undefined; createdBy: string }): Promise<TransactionDto> {
    const doc = await McpTransactionModel.create({ ...data, status: "RUNNING", log: [{ at: new Date(), message: `Transacción iniciada con ${data.steps.length} pasos` }] });
    return toDto(doc.toObject());
  }

  public async findByIdempotencyKey(key: string): Promise<TransactionDto | null> {
    const doc = await McpTransactionModel.findOne({ idempotencyKey: key }).lean();
    return doc ? toDto(doc) : null;
  }

  public async findMany(status: TransactionStatus | undefined, page: PageParams): Promise<Paginated<TransactionDto>> {
    const where = status ? { status } : {};
    const [docs, total] = await Promise.all([McpTransactionModel.find(where).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).lean(), McpTransactionModel.countDocuments(where)]);
    return { items: docs.map(toDto), total };
  }

  public async findById(id: string): Promise<TransactionDto | null> {
    const doc = await McpTransactionModel.findById(id).lean();
    return doc ? toDto(doc) : null;
  }

  // transition => cambio de estado ATÓMICO condicionado al estado esperado (dos rollbacks simultáneos: solo gana uno)
  public async transition(id: string, from: TransactionStatus[], to: TransactionStatus, message: string): Promise<TransactionDto | null> {
    const finished = ["COMPLETED", "COMPENSATED", "FAILED", "CANCELLED"].includes(to) ? { finishedAt: new Date() } : {};
    const doc = await McpTransactionModel.findOneAndUpdate(
      { _id: id, status: { $in: from } },
      { $set: { status: to, ...finished }, $push: { log: { at: new Date(), message } } },
      { new: true }
    ).lean();
    return doc ? toDto(doc) : null;
  }

  public async delete(id: string): Promise<void> {
    await McpTransactionModel.deleteOne({ _id: id });
  }

  // journal => SagaJournal de UNA transacción: "steps.<i>" actualiza solo ese paso y agrega la línea de bitácora
  public journal(id: string): SagaJournal {
    return {
      saveStep: async (index, step, message) => {
        await McpTransactionModel.updateOne({ _id: id }, { $set: { [`steps.${index}`]: step }, $push: { log: { at: new Date(), message } } });
      },
    };
  }
}

// RawTransaction => forma mínima del documento (lean u objeto) que se mapea; "| undefined" por exactOptionalPropertyTypes
type Maybe<T> = T | null | undefined;
type RawStep = { name: string; input?: unknown; output?: unknown; status?: Maybe<string>; error?: Maybe<string>; startedAt?: Maybe<Date>; finishedAt?: Maybe<Date> };
type RawTransaction = { _id: unknown; type?: Maybe<string>; status?: Maybe<string>; steps?: Maybe<RawStep[]>; log?: Maybe<Array<{ at?: Maybe<Date>; message?: Maybe<string> }>>; idempotencyKey?: Maybe<string>; createdBy?: Maybe<string>; createdAt?: Maybe<Date>; updatedAt?: Maybe<Date>; finishedAt?: Maybe<Date> };

function toDto(doc: RawTransaction): TransactionDto {
  return {
    id: String(doc._id),
    type: doc.type ?? "",
    status: (doc.status ?? "PENDING") as TransactionStatus,
    steps: (doc.steps ?? []).map((step) => ({
      name: step.name,
      input: (step.input ?? {}) as Record<string, unknown>,
      output: step.output ?? null,
      status: (step.status ?? "PENDING") as StepStatus,
      error: step.error ?? null,
      startedAt: step.startedAt ?? null,
      finishedAt: step.finishedAt ?? null,
    })),
    log: (doc.log ?? []).map((entry) => ({ at: entry.at ?? new Date(), message: entry.message ?? "" })),
    idempotencyKey: doc.idempotencyKey ?? null,
    createdBy: doc.createdBy ?? "",
    createdAt: doc.createdAt ?? new Date(),
    updatedAt: doc.updatedAt ?? new Date(),
    finishedAt: doc.finishedAt ?? null,
  };
}

export const mcpRepository = new McpRepository();
