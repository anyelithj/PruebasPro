import type { Observable } from 'rxjs';
import type { ChatChunk, ChatInput } from './models/assistant';
// [Puerto AssistantRepository · Dominio]: enviar un mensaje y recibir la respuesta del tutor en trozos | [Patrón]: Port (Hexagonal) + Repository + Iterator (flujo de trozos) | [Principio]: DIP + ISP
// `abstract class` (TS): contrato + token de inyección

export abstract class AssistantRepository {
  // [stream]: emite session → token… → done y completa; desuscribirse cancela la petición
  abstract stream(input: ChatInput): Observable<ChatChunk>;
}
