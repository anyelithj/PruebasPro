// email.exception.ts => errores de dominio del módulo Email (mapeados por error.middleware).
import { ConflictException, NotFoundException } from "../../../shared/filter/http-exception.filter";

export class EmailNotFoundException extends NotFoundException {
  constructor(id: string) {
    super("Email", id); // 404 EMAIL_NOT_FOUND
  }
}

export class EmailTemplateNotFoundException extends NotFoundException {
  constructor(id: string) {
    super("Email template", id); // 404 EMAIL_TEMPLATE_NOT_FOUND
  }
}

// 409 => nombre de plantilla repetido (índice único)
export class EmailTemplateNameTakenException extends ConflictException {
  constructor() {
    super("Ya existe una plantilla con ese nombre", "EMAIL_TEMPLATE_NAME_TAKEN");
  }
}
