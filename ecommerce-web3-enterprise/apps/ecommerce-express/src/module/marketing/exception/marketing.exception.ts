// marketing.exception.ts => errores de dominio del módulo Marketing (mapeados por error.middleware).
import { ConflictException, NotFoundException } from "../../../shared/filter/http-exception.filter";

export class CampaignNotFoundException extends NotFoundException {
  constructor(id: string) {
    super("Campaign", id); // 404 CAMPAIGN_NOT_FOUND
  }
}

// 409 => solo se editan o envían campañas en borrador o programadas (una enviada es un registro histórico)
export class CampaignLockedException extends ConflictException {
  constructor(status: string) {
    super(`La campaña en estado ${status} ya no se puede modificar`, "CAMPAIGN_LOCKED");
  }
}
