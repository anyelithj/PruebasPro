// analytics.exception.ts => errores de dominio del módulo Analytics (mapeados por error.middleware).
import { BadRequestException } from "../../../shared/filter/http-exception.filter";

// 400 => período inválido o demasiado amplio (protege la base de agregaciones gigantes)
export class InvalidRangeException extends BadRequestException {
  constructor(maxDays: number) {
    super(`El período debe tener fecha inicial anterior a la final y máximo ${maxDays} días`, "INVALID_ANALYTICS_RANGE");
  }
}
