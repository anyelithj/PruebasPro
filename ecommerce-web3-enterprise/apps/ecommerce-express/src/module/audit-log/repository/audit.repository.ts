// audit.repository.ts => audit trail en MongoDB (Mongoose). Patrón Repository: el service no conoce Mongoose.
// Solo expone escrituras de INSERCIÓN y la marca de revisión: no hay "update" genérico (inmutabilidad por diseño).
import type { FilterQuery } from "mongoose";
import { AuditLogModel, type AuditLogRecord, type AuditSeverity, type AuditSource } from "../model/audit.model";
import type { AuditBucketDto, AuditLogDto, AuditReportDto, CreateAuditDto } from "../dto/audit.dto";
import type { ListAuditQuery } from "../schema/audit.schema";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";
import { escapeRegex } from "../../../shared/util/slugify.util";

export type AuditFilters = Omit<ListAuditQuery, "page" | "limit">;
type Bucket = { _id: string | null; count: number };

export class AuditRepository {
  // insertMany => los registros llegan en lote (buffer del service): UNA escritura en vez de N (menos E/S)
  public async insertMany(entries: CreateAuditDto[]): Promise<void> {
    // "ordered: false" => un documento inválido no impide guardar el resto del lote
    if (entries.length > 0) await AuditLogModel.insertMany(entries, { ordered: false });
  }

  public async create(entry: CreateAuditDto): Promise<AuditLogDto> {
    return toDto(await AuditLogModel.create(entry));
  }

  // findMany => filtros combinables; "lean()" devuelve objetos planos (más rápido y con menos memoria que documentos)
  public async findMany(filters: AuditFilters, page: PageParams): Promise<Paginated<AuditLogDto>> {
    const where = toFilter(filters);
    // "Promise.all" => la página y el total se consultan en paralelo
    const [docs, total] = await Promise.all([
      AuditLogModel.find(where).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).lean(),
      AuditLogModel.countDocuments(where),
    ]);
    return { items: docs.map(toDto), total };
  }

  // findForExport => RF-30.3 filas filtradas para CSV/PDF (sin paginar; tope "max" para acotar memoria)
  public async findForExport(filters: AuditFilters, max: number): Promise<AuditLogDto[]> {
    return (await AuditLogModel.find(toFilter(filters)).sort({ createdAt: -1 }).limit(max).lean()).map(toDto);
  }

  // markReviewed => única mutación permitida: "$set" SOLO de los campos de revisión (el resto es "immutable")
  public async markReviewed(id: string, reviewed: boolean, reviewerId: string): Promise<AuditLogDto | null> {
    const changes = reviewed ? { reviewed, reviewedBy: reviewerId, reviewedAt: new Date() } : { reviewed, reviewedBy: null, reviewedAt: null };
    const doc = await AuditLogModel.findByIdAndUpdate(id, { $set: changes }, { new: true }).lean();
    return doc ? toDto(doc) : null;
  }

  // purgeOlderThan => retention policy manual (el índice TTL ya borra lo que supera AUDIT_RETENTION_DAYS)
  public async purgeOlderThan(date: Date): Promise<number> {
    return (await AuditLogModel.deleteMany({ createdAt: { $lt: date } })).deletedCount;
  }

  // report => UNA agregación con "$facet": varias agrupaciones sobre un solo recorrido de documentos (menos CPU)
  public async report(from: Date, to: Date): Promise<Omit<AuditReportDto, "from" | "to">> {
    // bucket => etapas reutilizables "agrupar por campo, ordenar por conteo y limitar" (DRY)
    const bucket = (field: string, limit = 10) => [{ $group: { _id: field, count: { $sum: 1 } } }, { $sort: { count: -1 as const } }, { $limit: limit }];
    const [result] = await AuditLogModel.aggregate<{ total: Array<{ n: number }>; critical: Array<{ n: number }>; byModule: Bucket[]; bySeverity: Bucket[]; topActors: Bucket[]; byDay: Bucket[] }>([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $facet: {
          total: [{ $count: "n" }],
          critical: [{ $match: { severity: "CRITICAL", reviewed: false } }, { $count: "n" }],
          byModule: bucket("$module"),
          bySeverity: bucket("$severity", 3),
          topActors: [{ $match: { actorId: { $ne: null } } }, ...bucket("$actorId")],
          // "$dateToString" => agrupa por día calendario (UTC) para la gráfica de actividad
          byDay: [{ $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
        },
      },
    ]);
    return {
      total: result?.total[0]?.n ?? 0,
      unreviewedCritical: result?.critical[0]?.n ?? 0,
      byModule: toBuckets(result?.byModule),
      bySeverity: toBuckets(result?.bySeverity),
      topActors: toBuckets(result?.topActors),
      byDay: toBuckets(result?.byDay),
    };
  }
}

// toBuckets => filas de "$group" -> { key, count } (función pura)
const toBuckets = (rows: Bucket[] = []): AuditBucketDto[] => rows.map((row) => ({ key: String(row._id ?? "—"), count: row.count }));

// toFilter => filtros del query -> FilterQuery de Mongoose (función pura; solo agrega las condiciones presentes)
function toFilter(filters: AuditFilters): FilterQuery<AuditLogRecord> {
  const where: FilterQuery<AuditLogRecord> = {};
  if (filters.actorId) where.actorId = filters.actorId;
  if (filters.module) where.module = filters.module;
  if (filters.severity) where.severity = filters.severity;
  if (filters.ip) where.ip = filters.ip; // RF-30.2
  if (filters.source) where.source = filters.source; // RF-30.6 origen del registro (servicio)
  // RF-30.6 "$text" => usa el índice de texto completo (palabras con raíz en español, sin distinguir mayúsculas)
  if (filters.q) where.$text = { $search: filters.q };
  if (filters.reviewed !== undefined) where.reviewed = filters.reviewed;
  // Búsqueda parcial sin distinguir mayúsculas; el texto se escapa (evita ReDoS / inyección de expresiones)
  if (filters.action) where.action = { $regex: escapeRegex(filters.action), $options: "i" };
  if (filters.from || filters.to) where.createdAt = { ...(filters.from ? { $gte: filters.from } : {}), ...(filters.to ? { $lte: filters.to } : {}) };
  return where;
}

// toDto => documento -> DTO (ObjectId expuesto como string; valores por defecto explícitos)
function toDto(doc: Partial<AuditLogRecord> & { _id: unknown; createdAt?: Date }): AuditLogDto {
  return {
    id: String(doc._id),
    actorId: doc.actorId ?? null,
    actorRoles: doc.actorRoles ?? [],
    action: doc.action ?? "",
    module: doc.module ?? "",
    resourceId: doc.resourceId ?? null,
    source: (doc.source ?? "HTTP") as AuditSource,
    severity: (doc.severity ?? "INFO") as AuditSeverity,
    status: doc.status ?? null,
    ip: doc.ip ?? null,
    metadata: (doc.metadata ?? {}) as Record<string, unknown>,
    reviewed: doc.reviewed ?? false,
    reviewedBy: doc.reviewedBy ?? null,
    reviewedAt: doc.reviewedAt ?? null,
    createdAt: doc.createdAt ?? new Date(),
  };
}

export const auditRepository = new AuditRepository();
