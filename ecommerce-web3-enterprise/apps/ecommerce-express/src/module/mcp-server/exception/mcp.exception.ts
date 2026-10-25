// mcp.exception.ts => errores de dominio del módulo MCP Server (mapeados por error.middleware).
import { BadRequestException, ConflictException, NotFoundException } from "../../../shared/filter/http-exception.filter";

export class McpTransactionNotFoundException extends NotFoundException {
  constructor(id: string) {
    super("MCP transaction", id); // 404 MCP_TRANSACTION_NOT_FOUND
  }
}

// 400 => la entrada de un paso no cumple el schema de ese paso
export class InvalidSagaStepException extends BadRequestException {
  constructor(step: string, detail: string) {
    super(`Entrada inválida en el paso "${step}": ${detail}`, "INVALID_SAGA_STEP");
  }
}

// 409 => la operación no aplica en el estado actual (rollback de algo no completado, borrar algo en curso)
export class InvalidTransactionStateException extends ConflictException {
  constructor(status: string, action: string) {
    super(`No se puede ${action} una transacción en estado ${status}`, "INVALID_TRANSACTION_STATE");
  }
}
