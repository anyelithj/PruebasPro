// cms.exception.ts => errores de dominio del módulo CMS (mapeados a HTTP por error.middleware).
import { ConflictException, NotFoundException } from "../../../shared/filter/http-exception.filter";

export class CmsContentNotFoundException extends NotFoundException {
  constructor(kind: string, key: string) {
    super(`Cms ${kind}`, key); // 404
  }
}

// 409 => el slug ya existe para ese tipo (índice único { kind, slug })
export class CmsSlugTakenException extends ConflictException {
  constructor(slug: string) {
    super(`El slug "${slug}" ya está en uso`, "CMS_SLUG_TAKEN");
  }
}

// 409 => el mismo email ya se registró en esa landing (idempotente para el usuario: se informa, no se duplica)
export class LeadAlreadyExistsException extends ConflictException {
  constructor() {
    super("Este email ya está suscrito a esta landing", "LEAD_ALREADY_EXISTS");
  }
}
