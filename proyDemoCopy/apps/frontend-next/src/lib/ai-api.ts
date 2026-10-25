import { apiFetch } from "./api-client";
import { getCurrentAccessToken } from "./auth";
// [Facade de la puerta de IA · Sprint 5.2]: llamadas server-side a NestJS /ai/* (que a su vez usa FastAPI) | [Patrón]: Facade | [Principio]: SRP + DRY | [Paradigma]: Funcional + asíncrono

// [Respuestas]: espejo de los modelos de FastAPI (snake_case tal como llegan)
export interface WeakTopicResult {
  topic: string;
  accuracy: number; // 0..1
  recommendation: string;
}
export interface StudyPlanStep {
  order: number;
  topic: string;
  activity: string;
  estimated_minutes: number;
}
export interface StudyPlanView {
  weaknesses: { weak_topics: WeakTopicResult[]; strong_topics: string[] };
  plan: { plan: StudyPlanStep[]; total_minutes: number } | null;
}

// [getStudyPlan]: POST /ai/feedback/study-plan | `null` si la IA no está disponible (la página sigue funcionando)
export async function getStudyPlan(topicAccuracy: Record<string, number>, threshold = 0.6): Promise<StudyPlanView | null> {
  const token = await getCurrentAccessToken();
  return apiFetch<StudyPlanView | null>("/ai/feedback/study-plan", { method: "POST", body: { topicAccuracy, threshold }, bearer: token ?? undefined });
}
