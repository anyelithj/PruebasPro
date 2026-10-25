// audit.service.ts => audit trail del sistema (sprint 7.2): registra cada escritura autenticada de la API, eventos de
// dominio sensibles y eventos de servicios externos; permite revisar, purgar por retención y reportar por período.
// Patrones: Observer (requestLogger y el bus de comercio publican; este servicio escucha), Singleton (una instancia),
// Memento (registros inmutables) y Buffer/Batch (las escrituras se agrupan 2 s: 1 insertMany en vez de N inserts).
// Winston: cada registro sale también por el logger estructurado (stdout => Loki/ELK aunque MongoDB esté caído).
import type { Request } from "express";
import { auditRepository, type AuditRepository } from "../repository/audit.repository";
import { AuditLogNotFoundException, InvalidAuditRangeException } from "../exception/audit.exception";
import type { AuditLogDto, AuditReportDto, CreateAuditDto, RetentionDto } from "../dto/audit.dto";
import type { AuditEventInput, ListAuditQuery, ReportQuery } from "../schema/audit.schema";
import type { AuditSeverity } from "../model/audit.model";
import { commerceEvents, type CommerceEvents } from "../../order/event/order.event";
import type { AuthenticatedRequestUser } from "../../auth/types/auth.types";
import { buildPaginationMeta, toPageParams } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";
import { logger } from "../../../shared/middleware/logger.middleware";
import { TypedEventBus } from "../../../shared/util/event-bus.util";

const FLUSH_DELAY_MS = 2_000; // Ventana del buffer: agrupa las escrituras de una ráfaga de requests
const MAX_BUFFER = 200; // Tope de memoria: si se llena antes, se escribe de inmediato
const DAY_MS = 24 * 60 * 60 * 1000;
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]); // Solo se auditan escrituras (las lecturas no cambian estado)
// Rutas de alto volumen o sin valor de auditoría: tracking anónimo, píxel de apertura de emails y el propio audit trail
const SKIPPED = [/^\/api\/v1\/analytic\/event/, /^\/api\/v1\/email\/[^/]+\/open/, /^\/api\/v1\/audit\//];
const ID_SEGMENT = /^([0-9a-f]{24}|[0-9a-f-]{36})$/i; // ObjectId de MongoDB o UUID de PostgreSQL

// auditEvents => RF-30.8 bus del módulo (Observer): cada lote guardado se publica; el gateway Socket.io lo reenvía a la
// sala "admin:audit" (monitoreo en tiempo real). Vive aquí y no en audit-insight para evitar un import circular.
export const auditEvents = new TypedEventBus<{ "audit.recorded": { entries: CreateAuditDto[] } }>("audit");

// Eventos de dominio que también quedan en el audit trail, con su severidad ("satisfies" => existen en el bus)
const AUDITED_EVENTS = {
  "order.cancelled": "WARNING",
  "payment.failed": "WARNING",
  "refund.updated": "INFO",
  "review.moderated": "INFO",
} as const satisfies Partial<Record<keyof CommerceEvents, AuditSeverity>>;

// describeRequest => "PATCH /api/v1/product/<uuid>" -> módulo "product", acción con ":id" y el ID aparte (función pura)
export function describeRequest(method: string, path: string): { module: string; action: string; resourceId: string | null } {
  const segments = (path.split("?")[0] ?? "").split("/").filter(Boolean); // ["api","v1","product","<uuid>"]
  const resourceId = segments.find((segment) => ID_SEGMENT.test(segment)) ?? null;
  const normalized = `/${segments.map((segment) => (ID_SEGMENT.test(segment) ? ":id" : segment)).join("/")}`;
  return { module: segments[2] ?? "api", action: `${method} ${normalized}`, resourceId };
}

// severityOf => 401/403 en una escritura = posible acceso indebido (CRITICAL); 5xx = fallo a revisar (WARNING)
const severityOf = (status: number): AuditSeverity => (status === 401 || status === 403 ? "CRITICAL" : status >= 500 ? "WARNING" : "INFO");

export class AuditService {
  private buffer: CreateAuditDto[] = [];
  private timer: NodeJS.Timeout | null = null; // Solo existe mientras hay registros pendientes (cero timers en reposo)

  constructor(private readonly repository: AuditRepository) {}

  // record => encola un registro; nunca lanza ni bloquea la request (la auditoría no puede tumbar la API)
  public record(entry: CreateAuditDto): void {
    logger.info("audit", entry); // Winston: copia inmediata en el log estructurado
    this.buffer.push(entry);
    if (this.buffer.length >= MAX_BUFFER) return void this.flush();
    // "??=" => programa UN solo flush por ventana (no un timer por registro)
    this.timer ??= setTimeout(() => void this.flush(), FLUSH_DELAY_MS);
  }

  // recordRequest => receptor del requestLogger (setAuditSink en el bootstrap): solo escrituras autenticadas.
  // Arrow function como propiedad => "this" queda ligado aunque se pase como callback suelto.
  public readonly recordRequest = (req: Request, status: number): void => {
    const user = req.user;
    if (!user || !MUTATING.has(req.method) || SKIPPED.some((pattern) => pattern.test(req.originalUrl))) return;
    const { module, action, resourceId } = describeRequest(req.method, req.originalUrl);
    this.record({ actorId: user.id, actorRoles: user.roles, action, module, resourceId, source: "HTTP", severity: severityOf(status), status, ip: req.ip ?? null });
  };

  // flush => vacía el buffer en UNA escritura; si MongoDB falla, el log de Winston ya conserva la copia
  public async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const batch = this.buffer;
    this.buffer = [];
    if (batch.length === 0) return;
    await this.repository.insertMany(batch).catch((error: unknown) => logger.error("audit_flush_failed", { count: batch.length, error }));
    auditEvents.emit("audit.recorded", { entries: batch }); // RF-30.8 también si MongoDB falló: el monitoreo no se detiene
  }

  // registerSubscribers => Observer: eventos de dominio sensibles -> audit trail (bootstrap, una sola vez)
  public registerSubscribers(): void {
    // "Object.entries(...) as" => tupla [evento, severidad] tipada (Object.entries pierde el tipo de las claves)
    for (const [event, severity] of Object.entries(AUDITED_EVENTS) as Array<[keyof typeof AUDITED_EVENTS, AuditSeverity]>) {
      commerceEvents.on(event, (payload) => {
        const data = payload as { userId?: string; orderId?: string; refundId?: string; reviewId?: string };
        const resourceId = data.orderId ?? data.refundId ?? data.reviewId ?? null;
        this.record({ actorId: data.userId ?? null, action: event, module: event.split(".")[0] ?? "event", resourceId, source: "EVENT", severity, metadata: { ...payload } });
      });
    }
  }

  // createAuditLog => POST /audit/log: registro inmediato (sin buffer) de un servicio externo autenticado
  public createAuditLog(input: AuditEventInput, actor: AuthenticatedRequestUser, ip: string | null): Promise<AuditLogDto> {
    return this.repository.create({ ...input, resourceId: input.resourceId ?? null, actorId: actor.id, actorRoles: actor.roles, source: "EXTERNAL", ip });
  }

  // listAuditLogs => "logs con filtros de actor y acción"
  public async listAuditLogs(query: ListAuditQuery): Promise<{ items: AuditLogDto[]; meta: PaginationMeta }> {
    // Desestructuración con "rest" => separa la paginación de los filtros
    const { page: _page, limit: _limit, ...filters } = query;
    const page = toPageParams(query);
    const { items, total } = await this.repository.findMany(filters, page);
    return { items, meta: buildPaginationMeta(page, total) };
  }

  // updateAuditLog => "marcar log como revisado — PATCH parcial"
  public async updateAuditLog(id: string, reviewed: boolean, reviewerId: string): Promise<AuditLogDto> {
    const updated = await this.repository.markReviewed(id, reviewed, reviewerId);
    if (!updated) throw new AuditLogNotFoundException(id);
    return updated;
  }

  // deleteAllAuditLogs => "purgar logs expirados según retention policy"
  public async deleteAllAuditLogs(olderThanDays: number): Promise<RetentionDto> {
    const olderThan = new Date(Date.now() - olderThanDays * DAY_MS);
    return { deleted: await this.repository.purgeOlderThan(olderThan), olderThan };
  }

  // listAuditReports => "reporte de auditoría por período" (por defecto los últimos 30 días)
  public async listAuditReports(query: ReportQuery): Promise<AuditReportDto> {
    const to = query.to ?? new Date();
    const from = query.from ?? new Date(to.getTime() - 30 * DAY_MS);
    if (from > to) throw new InvalidAuditRangeException();
    return { from, to, ...(await this.repository.report(from, to)) };
  }
}

export const auditService = new AuditService(auditRepository);
