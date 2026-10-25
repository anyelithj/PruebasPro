import type { Observable } from 'rxjs';
import type {
  Activity,
  ActivityDetail,
  ActivityFilter,
  ActivityContent,
  ActivityInput,
  Attempt,
  Draft,
  DraftInput,
  FullItem,
  ItemInput,
} from './models/practice';
// [Puerto PracticeRepository · Dominio · Sprints 8.14/8.15]: actividades, ítems (docente), intentos con corrección y borrador de IA | [Patrón]: Port (Hexagonal) + Repository | [Principio]: DIP + ISP
// `abstract class` (TS): contrato + token de inyección a la vez

export abstract class PracticeRepository {
  abstract activities(filter: ActivityFilter): Observable<Activity[]>;
  abstract activity(id: string): Observable<ActivityDetail>;
  abstract submit(itemId: string, answer: string[]): Observable<Attempt>;
  abstract myAttempts(activityId?: string): Observable<Attempt[]>;
  abstract createActivity(
    input: ActivityInput & { aiDraft?: boolean; items?: ItemInput[] },
  ): Observable<Activity>;
  abstract updateActivity(
    id: string,
    patch: Partial<ActivityInput> & { status?: 'draft' | 'published'; contents?: ActivityContent[] },
  ): Observable<Activity>;
  abstract archiveActivity(id: string): Observable<void>;
  abstract addItem(activityId: string, item: ItemInput): Observable<FullItem>;
  abstract updateItem(itemId: string, patch: Partial<ItemInput>): Observable<FullItem>;
  abstract removeItem(itemId: string): Observable<void>;
  abstract draft(input: DraftInput): Observable<Draft>;
}
