// audit.dto.ts => contratos de salida del módulo Audit Logs (CreateAuditDto, ReviewLogDto, RetentionDto, reporte).
import type { AuditSeverity, AuditSource } from "../model/audit.model";

// AuditLogDto => un registro del audit trail tal como lo ve el panel
export interface AuditLogDto {
  id: string;
  actorId: string | null;
  actorRoles: string[];
  action: string;
  module: string;
  resourceId: string | null;
  source: AuditSource;
  severity: AuditSeverity;
  status: number | null;
  ip: string | null;
  metadata: Record<string, unknown>;
  reviewed: boolean;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

// CreateAuditDto => lo que registran el middleware HTTP, los suscriptores del bus y POST /audit/log
export type CreateAuditDto = Pick<AuditLogDto, "actorId" | "action" | "module" | "source"> &
  Partial<Pick<AuditLogDto, "actorRoles" | "resourceId" | "severity" | "status" | "ip" | "metadata">>;

// RetentionDto => resultado de la purga manual por política de retención
export interface RetentionDto {
  deleted: number;
  olderThan: Date;
}

// Conteo agregado por una dimensión (módulo, acción, severidad, actor o día)
export interface AuditBucketDto {
  key: string;
  count: number;
}

// AuditReportDto => GET /audit/report: resumen del período para cumplimiento (compliance reporting)
export interface AuditReportDto {
  from: Date;
  to: Date;
  total: number;
  unreviewedCritical: number;
  byModule: AuditBucketDto[];
  bySeverity: AuditBucketDto[];
  topActors: AuditBucketDto[];
  byDay: AuditBucketDto[];
}
