// webhook.exception.ts => errores de dominio del módulo Webhooks (mapeados por error.middleware).
import { BadRequestException, ConflictException, NotFoundException } from "../../../shared/filter/http-exception.filter";

export class WebhookNotFoundException extends NotFoundException {
  constructor(id: string) {
    super("Webhook", id); // 404 WEBHOOK_NOT_FOUND
  }
}

// 400 => URL no permitida (anti-SSRF: en producción solo https y nunca hosts internos)
export class WebhookUrlNotAllowedException extends BadRequestException {
  constructor() {
    super("La URL del webhook no está permitida (usa https y un host público)", "WEBHOOK_URL_NOT_ALLOWED");
  }
}

// 409 => prueba sobre un webhook desactivado
export class WebhookInactiveException extends ConflictException {
  constructor() {
    super("El webhook está desactivado", "WEBHOOK_INACTIVE");
  }
}
