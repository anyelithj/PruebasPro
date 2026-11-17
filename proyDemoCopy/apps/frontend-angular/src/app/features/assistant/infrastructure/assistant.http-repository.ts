import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { concatMap, from, map, type Observable } from 'rxjs';
import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace → esbuild empaqueta solo lo usado
import { API_URL } from '@core/http/api-url.token';
import { postSse } from '@shared/utils/sse-post';
import { AssistantRepository } from '../domain/assistant.repository.port';
import {
  ChatInputSchema,
  ConversationDetailSchema,
  ConversationSummarySchema,
  toChatChunk,
  type ChatChunk,
  type ChatInput,
  type ConversationDetail,
  type ConversationSummary,
} from '../domain/models/assistant';
// [AssistantHttpRepository · Infraestructura]: POST /api/ai/assistant/chat/stream (BFF → NestJS → FastAPI) leído en streaming + [2026-10-28] CRUD /api/ai/assistant/conversations | [Patrón]: Adapter (mensaje SSE → ChatChunk) + Repository | [Principio]: SRP (único lugar con HTTP) + DIP + DRY (lectura SSE compartida con el Agente Guía: shared/utils/sse-post) | [Paradigma]: Reactivo
// [Por qué no EventSource]: EventSource solo hace GET; el mensaje viaja en el cuerpo del POST · [Seguridad]: ids codificados en la URL y respuestas validadas con Zod

@Injectable()
export class AssistantHttpRepository extends AssistantRepository {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_URL)}/ai/assistant`;
  private readonly conv = (id: string) => `${this.base}/conversations/${encodeURIComponent(id)}`;
  private readonly detail = map((r: unknown) => ConversationDetailSchema.parse(r));

  stream(input: ChatInput): Observable<ChatChunk> {
    const body = ChatInputSchema.parse(input); // [Fail Fast]: nunca se envía un mensaje vacío
    return postSse(this.http, `${this.base}/chat/stream`, {
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

  list(): Observable<ConversationSummary[]> {
    return this.http.get<unknown>(`${this.base}/conversations`).pipe(map((r) => z.array(ConversationSummarySchema).parse(r)));
  }

  get(id: string): Observable<ConversationDetail> {
    return this.http.get<unknown>(this.conv(id)).pipe(this.detail);
  }

  rename(id: string, title: string): Observable<ConversationSummary> {
    return this.http.patch<unknown>(this.conv(id), { title }).pipe(map((r) => ConversationSummarySchema.parse(r)));
  }

  remove(id: string): Observable<void> {
    return this.http.delete(this.conv(id)).pipe(map(() => undefined));
  }

  editMessage(id: string, messageId: string, content: string): Observable<ConversationDetail> {
    return this.http.patch<unknown>(`${this.conv(id)}/messages/${encodeURIComponent(messageId)}`, { content }).pipe(this.detail);
  }

  deleteMessage(id: string, messageId: string): Observable<ConversationDetail> {
    return this.http.delete<unknown>(`${this.conv(id)}/messages/${encodeURIComponent(messageId)}`).pipe(this.detail);
  }
}
