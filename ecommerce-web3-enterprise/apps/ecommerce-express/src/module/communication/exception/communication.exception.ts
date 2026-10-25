// communication.exception.ts => errores de dominio del módulo Communication.
import { ConflictException, NotFoundException } from "../../../shared/filter/http-exception.filter";

export class ConversationNotFoundException extends NotFoundException {
  constructor(id: string) {
    super("Conversation", id); // 404 CONVERSATION_NOT_FOUND (también si es de otro cliente: no se revela)
  }
}

// 409 => no se escribe en una conversación archivada ni se escala dos veces
export class ConversationClosedException extends ConflictException {
  constructor(status: string) {
    super(`La conversación está ${status}`, "CONVERSATION_CLOSED");
  }
}
