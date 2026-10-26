import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
import { API_URL } from '@core/http/api-url.token';
import { VocabularyRepository } from '../domain/vocabulary.repository.port';
import {
  LookupSchema,
  VocabularyEntrySchema,
  type EntryFilter,
  type EntryInput,
  type EntryPatch,
  type Lookup,
  type LookupInput,
  type VocabularyEntry,
} from '../domain/models/vocabulary';
// [VocabularyHttpRepository · Infraestructura · Sprint 8.3]: HttpClient hacia /api/vocabulary/* (BFF de Next.js → NestJS Vocabulary) | [Patrón]: Adapter + Repository | [Principio]: SRP (único lugar con HTTP) + DIP | [Paradigma]: Reactivo (RxJS)
// [Seguridad]: ids codificados en la URL · filtros como HttpParams (sin concatenar texto) · respuestas validadas con Zod (fail fast si el contrato cambia)

@Injectable()
export class VocabularyHttpRepository extends VocabularyRepository {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_URL)}/vocabulary`;
  private readonly id = (v: string) => encodeURIComponent(v);

  lookup(input: LookupInput): Observable<Lookup> {
    return this.http
      .post<unknown>(`${this.base}/lookup`, input)
      .pipe(map((r) => LookupSchema.parse(r)));
  }

  // [translate · 2026-10-23]: POST /vocabulary/lookup/translate → { translation } | Zod valida el contrato
  translate(text: string, source: string, target: string): Observable<string> {
    return this.http
      .post<unknown>(`${this.base}/lookup/translate`, { text, source, target })
      .pipe(map((r) => z.object({ translation: z.string() }).parse(r).translation));
  }

  getLookup(id: string): Observable<Lookup> {
    return this.http
      .get<unknown>(`${this.base}/lookup/${this.id(id)}`)
      .pipe(map((r) => LookupSchema.parse(r)));
  }

  list(filter: EntryFilter): Observable<VocabularyEntry[]> {
    // `HttpParams` (Angular): solo se envían los filtros con valor
    let params = new HttpParams();
    if (filter.language) params = params.set('language', filter.language);
    if (filter.q?.trim()) params = params.set('q', filter.q.trim());
    return this.http
      .get<unknown>(this.base, { params })
      .pipe(map((r) => z.array(VocabularyEntrySchema).parse(r)));
  }

  get(id: string): Observable<VocabularyEntry> {
    return this.http
      .get<unknown>(`${this.base}/${this.id(id)}`)
      .pipe(map((r) => VocabularyEntrySchema.parse(r)));
  }

  create(input: EntryInput): Observable<VocabularyEntry> {
    return this.http
      .post<unknown>(this.base, input)
      .pipe(map((r) => VocabularyEntrySchema.parse(r)));
  }

  update(id: string, patch: EntryPatch): Observable<VocabularyEntry> {
    return this.http
      .patch<unknown>(`${this.base}/${this.id(id)}`, patch)
      .pipe(map((r) => VocabularyEntrySchema.parse(r)));
  }

  remove(id: string): Observable<void> {
    return this.http.delete(`${this.base}/${this.id(id)}`).pipe(map(() => undefined));
  }
}
