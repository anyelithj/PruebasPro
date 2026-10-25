import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { z } from 'zod';
import { API_URL } from '@core/http/api-url.token';
import { DictionaryRepository } from './dictionary.repository.port';
import {
  MarkedWordSchema,
  WordLookupSchema,
  type MarkedWord,
  type MarkInput,
  type WordLookup,
  type WordQuery,
  type WordStatus,
} from './dictionary.model';
// [DictionaryHttpRepository · core · Sprint 10.3]: HttpClient hacia /api/vocabulary/lookup/word y /api/vocabulary/words (BFF de Next.js → NestJS Vocabulary) | [Patrón]: Adapter + Repository | [Principio]: SRP (único lugar con HTTP del diccionario) + DIP | [Paradigma]: Reactivo (RxJS)
// [Seguridad]: ids codificados en la URL · filtros como HttpParams · respuestas validadas con Zod

@Injectable()
export class DictionaryHttpRepository extends DictionaryRepository {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_URL)}/vocabulary`;

  lookup(q: WordQuery): Observable<WordLookup> {
    return this.http
      .post<unknown>(`${this.base}/lookup/word`, q)
      .pipe(map((r) => WordLookupSchema.parse(r)));
  }

  listMarked(language: string): Observable<MarkedWord[]> {
    return this.http
      .get<unknown>(`${this.base}/words`, { params: new HttpParams().set('language', language) })
      .pipe(map((r) => z.array(MarkedWordSchema).parse(r)));
  }

  mark(input: MarkInput): Observable<MarkedWord> {
    return this.http
      .post<unknown>(`${this.base}/words`, input)
      .pipe(map((r) => MarkedWordSchema.parse(r)));
  }

  setStatus(id: string, status: WordStatus): Observable<MarkedWord> {
    return this.http
      .patch<unknown>(`${this.base}/words/${encodeURIComponent(id)}/status`, { status })
      .pipe(map((r) => MarkedWordSchema.parse(r)));
  }

  unmark(id: string): Observable<void> {
    return this.http
      .delete(`${this.base}/words/${encodeURIComponent(id)}`)
      .pipe(map(() => undefined));
  }
}
