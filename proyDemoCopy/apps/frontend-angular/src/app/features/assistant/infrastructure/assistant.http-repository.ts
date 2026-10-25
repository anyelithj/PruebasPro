import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { concatMap, from, type Observable } from 'rxjs';
import { API_URL } from '@core/http/api-url.token';
import { postSse } from '@shared/utils/sse-post';
import { AssistantRepository } from '../domain/assistant.repository.port';
import {
  ChatInputSchema,
  toChatChunk,
  type ChatChunk,
  type ChatInput,
} from '../domain/models/assistant';
// [AssistantHttpRepository · Infraestructura]: POST /api/ai/assistant/chat/stream (BFF → NestJS → FastAPI) leído en streaming | [Patrón]: Adapter (mensaje SSE → ChatChunk) + Repository | [Principio]: SRP (único lugar con HTTP) + DIP + DRY (lectura SSE compartida con el Agente Guía: shared/utils/sse-post) | [Paradigma]: Reactivo
// [Por qué no EventSource]: EventSource solo hace GET; el mensaje viaja en el cuerpo del POST

@Injectable()
export class AssistantHttpRepository extends AssistantRepository {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/ai/assistant/chat/stream`;

  stream(input: ChatInput): Observable<ChatChunk> {
    const body = ChatInputSchema.parse(input); // [Fail Fast]: nunca se envía un mensaje vacío
    return postSse(this.http, this.url, {
      message: body.message,
      sessionId: body.sessionId,
      language: body.language,
      level: body.level,
    }).pipe(
      // `concatMap` + `from` (RxJS): 0..1 trozo por mensaje; eventos ajenos al tutor se descartan
      concatMap((m) => {
        const chunk = toChatChunk(m);
        return from(chunk ? [chunk] : []);
      }),
    );
  }
}
