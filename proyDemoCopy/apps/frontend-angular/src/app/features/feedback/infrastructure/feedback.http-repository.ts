import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
import { API_URL } from '@core/http/api-url.token';
import { FeedbackRepository } from '../domain/feedback.repository.port';
import { HistoryItemSchema, StudyPlanViewSchema, type HistoryItem, type StudyPlanView } from '../domain/models/feedback';
// [FeedbackHttpRepository · Infraestructura]: GET /api/quiz/sessions/me + POST /api/ai/feedback/study-plan (NestJS → FastAPI FeedbackEngine) | [Patrón]: Adapter + Repository | [Principio]: SRP (único lugar con HTTP) + DIP | [Paradigma]: Reactivo

@Injectable()
export class FeedbackHttpRepository extends FeedbackRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  history(): Observable<HistoryItem[]> {
    // `params` (Angular): query string codificado por HttpClient
    return this.http.get<unknown>(`${this.api}/quiz/sessions/me`, { params: { limit: 50 } }).pipe(map((r) => z.array(HistoryItemSchema).parse(r)));
  }

  studyPlan(topicAccuracy: Record<string, number>, threshold: number): Observable<StudyPlanView | null> {
    return this.http
      .post<unknown>(`${this.api}/ai/feedback/study-plan`, { topicAccuracy, threshold })
      .pipe(map((r) => StudyPlanViewSchema.nullable().parse(r ?? null)));
  }
}
