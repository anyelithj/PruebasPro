import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { z } from 'zod';
import { API_URL } from '@core/http/api-url.token';
import { GrammarRepository } from '../domain/grammar.repository.port';
import {
  ExampleSchema,
  GrammarTopicSchema,
  SectionSchema,
  TopicDetailSchema,
  type Example,
  type ExamplePatch,
  type GrammarTopic,
  type Section,
  type SectionInput,
  type TopicDetail,
  type TopicFilter,
  type TopicInput,
} from '../domain/models/grammar';
// [GrammarHttpRepository · Infraestructura · Sprints 10.11/10.12]: HttpClient hacia /api/grammar/* (BFF de Next.js → NestJS Grammar) | [Patrón]: Adapter + Repository | [Principio]: SRP (único lugar con HTTP) + DIP | [Paradigma]: Reactivo (RxJS)
// [Seguridad]: ids codificados en la URL · filtros como HttpParams · respuestas validadas con Zod

@Injectable()
export class GrammarHttpRepository extends GrammarRepository {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_URL)}/grammar`;
  private readonly id = (v: string) => encodeURIComponent(v);
  private readonly done = map(() => undefined);

  listTopics(f: TopicFilter): Observable<GrammarTopic[]> {
    let params = new HttpParams();
    if (f.language) params = params.set('language', f.language);
    if (f.level) params = params.set('level', f.level);
    if (f.mine) params = params.set('mine', '1');
    return this.http.get<unknown>(`${this.base}/topics`, { params }).pipe(map((r) => z.array(GrammarTopicSchema).parse(r)));
  }
  getTopic(id: string): Observable<TopicDetail> {
    return this.http.get<unknown>(`${this.base}/topics/${this.id(id)}`).pipe(map((r) => TopicDetailSchema.parse(r)));
  }
  createTopic(input: TopicInput): Observable<GrammarTopic> {
    return this.http.post<unknown>(`${this.base}/topics`, input).pipe(map((r) => GrammarTopicSchema.parse(r)));
  }
  draft(input: TopicInput) {
    const { title, language, level } = input;
    return this.http
      .post<unknown>(`${this.base}/topics/draft`, { title, language, level })
      .pipe(map((r) => z.object({ id: z.string(), sections: z.number(), model: z.string() }).parse(r)));
  }
  updateTopic(id: string, patch: Partial<TopicInput> & { status?: GrammarTopic['status'] }): Observable<GrammarTopic> {
    return this.http.patch<unknown>(`${this.base}/topics/${this.id(id)}`, patch).pipe(map((r) => GrammarTopicSchema.parse(r)));
  }
  archiveTopic(id: string): Observable<void> {
    return this.http.delete(`${this.base}/topics/${this.id(id)}`).pipe(this.done);
  }
  enrich(id: string) {
    return this.http
      .post<unknown>(`${this.base}/topics/${this.id(id)}/enrich`, {})
      .pipe(map((r) => z.object({ updated: z.number() }).parse(r)));
  }
  addSection(topicId: string, input: SectionInput): Observable<Section> {
    return this.http.post<unknown>(`${this.base}/topics/${this.id(topicId)}/sections`, input).pipe(map((r) => SectionSchema.parse(r)));
  }
  updateSection(id: string, patch: Partial<SectionInput>): Observable<Section> {
    return this.http.patch<unknown>(`${this.base}/sections/${this.id(id)}`, patch).pipe(map((r) => SectionSchema.parse(r)));
  }
  removeSection(id: string): Observable<void> {
    return this.http.delete(`${this.base}/sections/${this.id(id)}`).pipe(this.done);
  }
  addExample(sectionId: string, text: string): Observable<Example> {
    return this.http.post<unknown>(`${this.base}/sections/${this.id(sectionId)}/examples`, { text }).pipe(map((r) => ExampleSchema.parse(r)));
  }
  updateExample(id: string, patch: ExamplePatch): Observable<Example> {
    return this.http.patch<unknown>(`${this.base}/examples/${this.id(id)}`, patch).pipe(map((r) => ExampleSchema.parse(r)));
  }
  removeExample(id: string): Observable<void> {
    return this.http.delete(`${this.base}/examples/${this.id(id)}`).pipe(this.done);
  }
}
