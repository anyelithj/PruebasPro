// automation.exception.ts => errores de dominio del módulo Automation.
import { BadGatewayException, ConflictException, NotFoundException, ServiceUnavailableException } from "../../../shared/filter/http-exception.filter";

export class WorkflowNotFoundException extends NotFoundException {
  constructor(id: string) {
    super("Workflow", id); // 404 WORKFLOW_NOT_FOUND
  }
}

// 409 => no se ejecuta un flujo desactivado
export class WorkflowInactiveException extends ConflictException {
  constructor() {
    super("El flujo está desactivado", "WORKFLOW_INACTIVE");
  }
}

// 503 => se pidió crear el flujo en n8n pero la API de n8n no está configurada
export class N8nUnavailableException extends ServiceUnavailableException {
  constructor() {
    super("La API de n8n no está configurada (N8N_API_URL / N8N_API_KEY)");
  }
}

// 502 => n8n respondió con error al crear/activar/borrar el flujo
export class N8nApiException extends BadGatewayException {
  constructor(detail: string) {
    super(`n8n rechazó la operación: ${detail}`, "N8N_ERROR");
  }
}
