// dashboard.exception.ts => errores de dominio del módulo Admin Dashboard (mapeados por error.middleware).
import { NotFoundException, UnprocessableException } from "../../../shared/filter/http-exception.filter";

export class WidgetNotFoundException extends NotFoundException {
  constructor(id: string) {
    super("Widget", id); // 404 WIDGET_NOT_FOUND (también si el widget es de otro administrador)
  }
}

// 422 => tope de widgets por panel (evita paneles que disparan decenas de consultas)
export class WidgetLimitException extends UnprocessableException {
  constructor(max: number) {
    super(`Máximo ${max} widgets por panel`, "WIDGET_LIMIT_REACHED");
  }
}
