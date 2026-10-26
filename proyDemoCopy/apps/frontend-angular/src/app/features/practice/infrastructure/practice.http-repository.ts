import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
import { API_URL } from '@core/http/api-url.token';
import { PracticeRepository } from '../domain/practice.repository.port';
import {
  ActivityDetailSchema,
  ActivitySchema,
  AttemptSchema,
  DraftSchema,
  FullItemSchema,
  type Activity,
  type ActivityDetail,
  type ActivityFilter,
  type ActivityContent,
  type ActivityInput,
  type Attempt,
  type Draft,
  type DraftInput,
  type FullItem,
  type ItemInput,
} from '../domain/models/practice';
// [PracticeHttpRepository · Infraestructura · Sprints 8.14/8.15]: HttpClient hacia /api/practice/* (BFF de Next.js → NestJS Practice → FastAPI Grading) | [Patrón]: Adapter + Repository | [Principio]: SRP (único lugar con HTTP) + DIP | [Paradigma]: Reactivo (RxJS)
// [Seguridad]: ids codificados · filtros como HttpParams · respuestas validadas con Zod · el rol lo vuelve a comprobar NestJS (docente/admin para escribir)

@Injectable()
export class PracticeHttpRepository extends PracticeRepository {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_URL)}/practice`;
  private readonly id = (v: string) => encodeURIComponent(v);

  activities(filter: ActivityFilter): Observable<Activity[]> {
    let params = new HttpParams();
    for (const k of ['language', 'level', 'skill'] as const)
      if (filter[k]) params = params.set(k, filter[k]!);
    if (filter.mine) params = params.set('mine', 'true');
    return this.http
      .get<unknown>(`${this.base}/activities`, { params })
      .pipe(map((r) => z.array(ActivitySchema).parse(r)));
  }

  activity(id: string): Observable<ActivityDetail> {
    return this.http
      .get<unknown>(`${this.base}/activities/${this.id(id)}`)
      .pipe(map((r) => ActivityDetailSchema.parse(r)));
  }

  submit(itemId: string, answer: string[]): Observable<Attempt> {
    return this.http
      .post<unknown>(`${this.base}/attempts`, { itemId, answer })
      .pipe(map((r) => AttemptSchema.parse(r)));
  }

  myAttempts(activityId?: string): Observable<Attempt[]> {
    const params = activityId ? new HttpParams().set('activityId', activityId) : undefined;
    return this.http
      .get<unknown>(`${this.base}/attempts/me`, { params })
      .pipe(map((r) => z.array(AttemptSchema).parse(r)));
  }

  createActivity(
    input: ActivityInput & { aiDraft?: boolean; items?: ItemInput[] },
  ): Observable<Activity> {
    return this.http
      .post<unknown>(`${this.base}/activities`, input)
      .pipe(map((r) => ActivitySchema.parse(r)));
  }

  updateActivity(
    id: string,
    patch: Partial<ActivityInput> & { status?: 'draft' | 'published'; contents?: ActivityContent[] },
  ): Observable<Activity> {
    return this.http
      .patch<unknown>(`${this.base}/activities/${this.id(id)}`, patch)
      .pipe(map((r) => ActivitySchema.parse(r)));
  }

  archiveActivity(id: string): Observable<void> {
    return this.http.delete(`${this.base}/activities/${this.id(id)}`).pipe(map(() => undefined));
  }

  addItem(activityId: string, item: ItemInput): Observable<FullItem> {
    return this.http
      .post<unknown>(`${this.base}/activities/${this.id(activityId)}/items`, item)
      .pipe(map((r) => FullItemSchema.parse(r)));
  }

  updateItem(itemId: string, patch: Partial<ItemInput>): Observable<FullItem> {
    return this.http
      .patch<unknown>(`${this.base}/items/${this.id(itemId)}`, patch)
      .pipe(map((r) => FullItemSchema.parse(r)));
  }

  removeItem(itemId: string): Observable<void> {
    return this.http.delete(`${this.base}/items/${this.id(itemId)}`).pipe(map(() => undefined));
  }

  draft(input: DraftInput): Observable<Draft> {
    return this.http
      .post<unknown>(`${this.base}/activities/draft`, input)
      .pipe(map((r) => DraftSchema.parse(r)));
  }
}
