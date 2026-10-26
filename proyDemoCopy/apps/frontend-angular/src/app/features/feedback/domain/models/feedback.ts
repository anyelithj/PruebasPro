import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
// [Modelo Feedback · Dominio]: historial de exámenes, debilidades y plan de estudio (contratos de /api/quiz/sessions/me y /api/ai/feedback/study-plan) + regla pura de precisión por tema | [Patrón]: Schema-First (Zod) + Group-Aggregate | [Principio]: SSOT + Type-Safe | [Paradigma]: Funcional

// [Historial]: solo los campos que usa el cálculo (Zod descarta el resto)
export const HistoryItemSchema = z.object({
  quizCategory: z.string(),
  status: z.string(),
  correctCount: z.number(),
  totalQuestions: z.number(),
});
export type HistoryItem = z.infer<typeof HistoryItemSchema>;

export const WeakTopicSchema = z.object({ topic: z.string(), accuracy: z.number(), recommendation: z.string() });
export const StudyPlanViewSchema = z.object({
  weaknesses: z.object({ weak_topics: z.array(WeakTopicSchema), strong_topics: z.array(z.string()) }),
  plan: z
    .object({
      plan: z.array(z.object({ order: z.number(), topic: z.string(), activity: z.string(), estimated_minutes: z.number() })),
      total_minutes: z.number(),
    })
    .nullable(),
});
export type StudyPlanView = z.infer<typeof StudyPlanViewSchema>;
export type WeakTopic = z.infer<typeof WeakTopicSchema>;

export const WEAK_THRESHOLD = 0.6; // Misma umbral que la pantalla /feedback de Next.js

// [accuracyByTopic]: aciertos / preguntas por categoría en exámenes completados → entrada del análisis de debilidades
// Misma regla que accuracyByCategory de Next.js (DRY de lógica; la clave aquí es el código de categoría)
export function accuracyByTopic(items: readonly HistoryItem[]): Record<string, number> {
  const acc = new Map<string, { correct: number; total: number }>(); // `Map` (ES2015): acumulador por tema
  for (const i of items) {
    if (i.status !== 'completed') continue;
    const prev = acc.get(i.quizCategory) ?? { correct: 0, total: 0 };
    acc.set(i.quizCategory, { correct: prev.correct + i.correctCount, total: prev.total + i.totalQuestions });
  }
  // `Object.fromEntries` (ES2019): Map → objeto JSON para la API
  return Object.fromEntries([...acc].filter(([, v]) => v.total > 0).map(([k, v]) => [k, v.correct / v.total]));
}
