import type { Observable } from 'rxjs';
import type { HistoryItem, StudyPlanView } from './models/feedback';
// [Puerto FeedbackRepository · Dominio]: historial de exámenes y plan de estudio | [Patrón]: Port (Hexagonal) + Repository | [Principio]: DIP + ISP
// `abstract class` (TS): contrato + token de inyección

export abstract class FeedbackRepository {
  abstract history(): Observable<HistoryItem[]>;
  // [studyPlan]: null → el servicio de IA no está disponible (la UI lo explica sin romperse)
  abstract studyPlan(topicAccuracy: Record<string, number>, threshold: number): Observable<StudyPlanView | null>;
}
