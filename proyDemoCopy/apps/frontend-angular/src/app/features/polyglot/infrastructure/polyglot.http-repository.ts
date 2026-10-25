import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { z } from 'zod';
import { API_URL } from '@core/http/api-url.token';
import { PolyglotRepository } from '../domain/polyglot.repository.port';
import {
  ConceptDetailSchema,
  ConceptSchema,
  TableSchema,
  TermSchema,
  TopicSchema,
  ViewSchema,
  type ComparisonTable,
  type Concept,
  type ConceptDetail,
  type ConceptInput,
  type Term,
  type TermInput,
  type Topic,
  type TopicInput,
  type View,
} from '../domain/models/polyglot';
// [PolyglotHttpRepository · Infraestructura · Sprints 10.7/10.8]: HttpClient hacia /api/polyglot/* (BFF de Next.js → NestJS Polyglot) | [Patrón]: Adapter + Repository | [Principio]: SRP (único lugar con HTTP) + DIP | [Paradigma]: Reactivo (RxJS)
// [Seguridad]: ids codificados en la URL · query como HttpParams · respuestas validadas con Zod (fail fast si el contrato cambia)

@Injectable()
export class PolyglotHttpRepository extends PolyglotRepository {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_URL)}/polyglot`;
  private readonly id = (v: string) => encodeURIComponent(v);
  private readonly done = map(() => undefined);

  listTopics(): Observable<Topic[]> {
    return this.http.get<unknown>(`${this.base}/topics`).pipe(map((r) => z.array(TopicSchema).parse(r)));
  }
  getTopic(id: string): Observable<Topic> {
    return this.http.get<unknown>(`${this.base}/topics/${this.id(id)}`).pipe(map((r) => TopicSchema.parse(r)));
  }
  createTopic(input: TopicInput): Observable<Topic> {
    return this.http.post<unknown>(`${this.base}/topics`, input).pipe(map((r) => TopicSchema.parse(r)));
  }
  updateTopic(id: string, patch: Partial<TopicInput> & { status?: Topic['status'] }): Observable<Topic> {
    return this.http.patch<unknown>(`${this.base}/topics/${this.id(id)}`, patch).pipe(map((r) => TopicSchema.parse(r)));
  }
  archiveTopic(id: string): Observable<void> {
    return this.http.delete(`${this.base}/topics/${this.id(id)}`).pipe(this.done);
  }
  draft(topicId: string, body: { kind: 'word' | 'phrase'; count: number }) {
    return this.http
      .post<unknown>(`${this.base}/topics/${this.id(topicId)}/draft`, body)
      .pipe(map((r) => z.object({ added: z.number(), model: z.string() }).parse(r)));
  }
  enrich(topicId: string) {
    return this.http
      .post<unknown>(`${this.base}/topics/${this.id(topicId)}/ipa`, {})
      .pipe(map((r) => z.object({ updated: z.number(), failed: z.number() }).parse(r)));
  }
  table(topicId: string, languages: readonly string[]): Observable<ComparisonTable> {
    const params = new HttpParams().set('topic', topicId).set('languages', languages.join(','));
    return this.http.get<unknown>(`${this.base}/table`, { params }).pipe(map((r) => TableSchema.parse(r)));
  }
  getConcept(id: string): Observable<ConceptDetail> {
    return this.http.get<unknown>(`${this.base}/concepts/${this.id(id)}`).pipe(map((r) => ConceptDetailSchema.parse(r)));
  }
  addConcept(topicId: string, input: ConceptInput): Observable<Concept> {
    return this.http
      .post<unknown>(`${this.base}/topics/${this.id(topicId)}/concepts`, clean(input))
      .pipe(map((r) => ConceptSchema.parse(r)));
  }
  updateConcept(id: string, patch: Partial<ConceptInput>): Observable<Concept> {
    return this.http.patch<unknown>(`${this.base}/concepts/${this.id(id)}`, clean(patch)).pipe(map((r) => ConceptSchema.parse(r)));
  }
  removeConcept(id: string): Observable<void> {
    return this.http.delete(`${this.base}/concepts/${this.id(id)}`).pipe(this.done);
  }
  upsertTerms(conceptId: string, terms: TermInput[]): Observable<Term[]> {
    return this.http
      .post<unknown>(`${this.base}/concepts/${this.id(conceptId)}/terms`, { terms })
      .pipe(map((r) => z.array(TermSchema).parse(r)));
  }
  reviewTerm(id: string, patch: { text?: string; ipa?: string; ipaUs?: string }): Observable<Term> {
    return this.http.patch<unknown>(`${this.base}/terms/${this.id(id)}`, patch).pipe(map((r) => TermSchema.parse(r)));
  }
  removeTerm(id: string): Observable<void> {
    return this.http.delete(`${this.base}/terms/${this.id(id)}`).pipe(this.done);
  }
  listViews(): Observable<View[]> {
    return this.http.get<unknown>(`${this.base}/views/me`).pipe(map((r) => z.array(ViewSchema).parse(r)));
  }
  saveView(body: { topicId: string; name?: string; languages: readonly string[] }): Observable<View> {
    return this.http.post<unknown>(`${this.base}/views`, body).pipe(map((r) => ViewSchema.parse(r)));
  }
  updateView(id: string, patch: { name?: string; languages?: readonly string[] }): Observable<View> {
    return this.http.patch<unknown>(`${this.base}/views/${this.id(id)}`, patch).pipe(map((r) => ViewSchema.parse(r)));
  }
  deleteView(id: string): Observable<void> {
    return this.http.delete(`${this.base}/views/${this.id(id)}`).pipe(this.done);
  }
}

// [clean]: no envía URL ni licencia vacías (el DTO de NestJS valida `IsUrl` si el campo existe)
const clean = <T extends Record<string, unknown>>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined)) as Partial<T>;
