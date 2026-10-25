// audit.exception.ts => errores de dominio del módulo Audit Logs (mapeados por error.middleware).
import { BadRequestException, NotFoundException } from "../../../shared/filter/http-exception.filter";

export class AuditLogNotFoundException extends NotFoundException {
  constructor(id: string) {
    super("Audit log", id); // 404 AUDIT_LOG_NOT_FOUND
  }
}

// 400 => período inválido en el reporte (desde > hasta)
export class InvalidAuditRangeException extends BadRequestException {
  constructor() {
    super("La fecha inicial debe ser anterior a la final", "INVALID_AUDIT_RANGE");
  }
}
