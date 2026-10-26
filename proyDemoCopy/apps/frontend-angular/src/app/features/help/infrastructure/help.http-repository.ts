import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { concatMap, from, map, type Observable } from 'rxjs';
import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
import { API_URL } from '@core/http/api-url.token';
import { postSse } from '@shared/utils/sse-post';
import { HelpRepository } from '../domain/help.repository.port';
import {
  FaqSchema,
  ManualArticleSchema,
  ManualEntrySchema,
  ReindexResultSchema,
  toGuideChunk,
  type AnsweredBy,
  type Faq,
  type FaqInput,
  type GuideChunk,
  type GuideQuestion,
  type HelpLocale,
  type ManualArticle,
  type ManualEntry,
  type ReindexResult,
} from '../domain/models/help';
// [HelpHttpRepository · Infraestructura]: HttpClient hacia /api/help/* (BFF de Next.js → NestJS → FastAPI) | [Patrón]: Adapter + Repository | [Principio]: SRP (único lugar con HTTP) + DIP + DRY (SSE por POST con shared/utils/sse-post, igual que el tutor) | [Paradigma]: Reactivo (RxJS)
// [Seguridad]: ids y slugs codificados en la URL · respuestas validadas con Zod · el rol nunca se envía (lo pone el JWT)

@Injectable()
export class HelpHttpRepository extends HelpRepository {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_URL)}/help`;
  private readonly seg = (v: string) => encodeURIComponent(v);

  faqs(locale: HelpLocale): Observable<Faq[]> {
    return this.http.get<unknown>(`${this.base}/faqs`, { params: { locale } }).pipe(map((r) => z.array(FaqSchema).parse(r)));
  }

  // [toBody]: '' → sin artículo (el DTO de NestJS lo trata como opcional)
  private toBody({ manualSlug, ...rest }: FaqInput) {
    return { ...rest, ...(manualSlug ? { manualSlug } : {}) };
  }

  createFaq(input: FaqInput): Observable<Faq> {
    return this.http.post<unknown>(`${this.base}/faqs`, this.toBody(input)).pipe(map((r) => FaqSchema.parse(r)));
  }

  updateFaq(id: string, input: FaqInput): Observable<Faq> {
    return this.http.patch<unknown>(`${this.base}/faqs/${this.seg(id)}`, this.toBody(input)).pipe(map((r) => FaqSchema.parse(r)));
  }

  archiveFaq(id: string): Observable<void> {
    return this.http.delete(`${this.base}/faqs/${this.seg(id)}`).pipe(map(() => undefined));
  }

  manual(locale: HelpLocale): Observable<ManualEntry[]> {
    return this.http.get<unknown>(`${this.base}/manual`, { params: { locale } }).pipe(map((r) => z.array(ManualEntrySchema).parse(r)));
  }

  article(slug: string, locale: HelpLocale): Observable<ManualArticle> {
    return this.http.get<unknown>(`${this.base}/manual/${this.seg(slug)}`, { params: { locale } }).pipe(map((r) => ManualArticleSchema.parse(r)));
  }

  reindex(): Observable<ReindexResult> {
    return this.http.post<unknown>(`${this.base}/manual/reindex`, {}).pipe(map((r) => ReindexResultSchema.parse(r)));
  }

  // [ask]: SSE por POST → trozos tipados; eventos desconocidos se descartan
  ask(q: GuideQuestion): Observable<GuideChunk> {
    return postSse(this.http, `${this.base}/ask/stream`, q).pipe(
      concatMap((m) => {
        const chunk = toGuideChunk(m);
        return from(chunk ? [chunk] : []);
      }),
    );
  }

  rate(sessionId: string, messageIndex: number, helpful: boolean, answeredBy: AnsweredBy, route?: string): Observable<void> {
    return this.http
      .post(`${this.base}/ask/${this.seg(sessionId)}/feedback`, { messageIndex, helpful, answeredBy, ...(route ? { route } : {}) })
      .pipe(map(() => undefined));
  }

  deleteConversation(sessionId: string): Observable<void> {
    return this.http.delete(`${this.base}/conversations/${this.seg(sessionId)}`).pipe(map(() => undefined));
  }
}
