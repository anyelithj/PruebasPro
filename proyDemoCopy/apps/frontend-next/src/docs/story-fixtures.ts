// [story-fixtures · Storybook · Next.js 16 · 2026-11-17]: datos de ejemplo COMPARTIDOS por las historias de src/components (cursos, exámenes, currículo, landing)
// [Patrón]: Object Mother / Test Data Builder (un solo sitio crea entidades válidas) | [Principio]: DRY + SSOT (los tipos son los de src/types → si el contrato cambia, falla la compilación)
// [Paradigma]: Declarativo (constantes inmutables) · solo texto propio y corto (sin contenido con derechos)
import { getDictionary } from "@aula/shared-i18n"; // [i18n]: diccionario real del español → las historias muestran los textos de la app
import type { ActionResult } from "@/components/admin/RowActions"; // Contrato de las acciones de Gestión
import type { CourseMaterial, CourseResponse } from "@/types/courses"; // `import type` (TS): solo tipos, se borran al compilar
import type { CurriculumGeneration } from "@/types/curriculum";
import type { AnswerFeedback, QuestionPublic, QuizListItem, SessionAnswer } from "@/types/quiz";

// [dict]: diccionario «es» (mismo que usa el servidor por defecto) → props `l`/`n` de la landing
export const dict = getDictionary("es");

// [questions]: tres tipos de pregunta (opción múltiple, verdadero/falso, abierta) | `satisfies` (TS): valida sin ensanchar el tipo
export const questions = [
  { id: "q1", text: "¿Cuál es el pasado de «go»?", type: "multiple_choice", options: ["goed", "went", "gone", "going"], difficulty: "easy", position: 0, timeLimitSeconds: 30 },
  { id: "q2", text: "«She don't like tea» es correcto.", type: "true_false", options: ["Verdadero", "Falso"], difficulty: "medium", position: 1, timeLimitSeconds: 20 },
  { id: "q3", text: "Traduce: «Tengo dos hermanos».", type: "open_answer", difficulty: "hard", position: 2 },
] satisfies QuestionPublic[];

// [answers]: respuestas de una sesión (una acertada, una fallada, una abierta)
export const answers = [
  { questionId: "q1", userAnswer: "went", isCorrect: true, score: 100, timeTakenMs: 4200, answeredAt: "2026-11-17T10:00:00Z" },
  { questionId: "q2", userAnswer: "Verdadero", isCorrect: false, score: 0, timeTakenMs: 6100, answeredAt: "2026-11-17T10:00:10Z" },
  { questionId: "q3", userAnswer: "I have two brothers", isCorrect: true, score: 90, timeTakenMs: 15000, answeredAt: "2026-11-17T10:00:30Z" },
] satisfies SessionAnswer[];

// [feedbacks]: retroalimentación pedagógica por pregunta (Record<id, feedback>)
export const feedbacks: Record<string, AnswerFeedback> = {
  q2: { questionId: "q2", feedback: "Con «she» el auxiliar es «doesn't»: «She doesn't like tea».", strategy: "rule" },
  q3: { questionId: "q3", feedback: "¡Bien! «brothers» va en plural porque son dos.", strategy: "llm" },
};

// [quizItem]: ficha de examen para tarjetas y tablas | spread (JS) en `quizzes` para variar campos sin repetir
export const quizItem = { id: "quiz-1", title: "Pasado simple A2", category: "grammar", difficulty: "medium", questionsCount: 10, timePerQuestionSeconds: 30, language: "en", isPublished: true } satisfies QuizListItem;
export const quizzes: QuizListItem[] = [
  quizItem,
  { ...quizItem, id: "quiz-2", title: "Vocabulario de la casa", category: "vocabulary", difficulty: "easy", language: "fr", isPublished: false },
  { ...quizItem, id: "quiz-3", title: "Comprensión lectora B2", category: "reading", difficulty: "hard", language: "de" },
];

// [course]: curso de pago con progreso parcial (todas las props obligatorias de CourseResponse)
export const course = {
  id: "course-1",
  title: "Inglés para viajar",
  slug: "ingles-para-viajar",
  shortDescription: "Frases clave para aeropuertos, hoteles y restaurantes.",
  description: "Curso práctico de nivel A2.",
  content: null,
  category: "A2",
  categoryLabel: "A2",
  group: "EN",
  instructor: "Ana Pérez",
  instructorTitle: "Docente de inglés",
  color: "#2563eb",
  icon: "plane",
  tags: ["viajes", "conversación"],
  eje: 1,
  lab: null,
  price: 49,
  originalPrice: 79,
  currency: "USD",
  isFree: false,
  tokens: 0,
  discountPercent: 38,
  durationHours: 12,
  level: "A2",
  rating: 4.7,
  studentsCount: 320,
  modality: "Virtual",
  isProBono: false,
  isPublished: true,
  progress: 40,
  isFavorite: false,
  reaction: null,
  likesCount: 12,
  lovesCount: 5,
  hasAccess: true,
  completedMaterialIds: ["m1"],
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
} satisfies CourseResponse;
export const courses: CourseResponse[] = [course, { ...course, id: "course-2", title: "Francés desde cero", group: "FR", color: "#dc2626", isFree: true, price: 0, originalPrice: null, progress: 0 }];

// [materials]: temario de tres lecciones (video, pdf, enlace)
export const materials: CourseMaterial[] = [
  { id: "m1", courseId: "course-1", title: "Saludos en el aeropuerto", kind: "video", originalName: "saludos.mp4", mimeType: "video/mp4", sizeBytes: 1_200_000, position: 0, createdAt: "2026-10-01T00:00:00Z" },
  { id: "m2", courseId: "course-1", title: "Vocabulario del hotel", kind: "pdf", originalName: "hotel.pdf", mimeType: "application/pdf", sizeBytes: 300_000, position: 1, createdAt: "2026-10-01T00:00:00Z" },
  { id: "m3", courseId: "course-1", title: "Pedir en un restaurante", kind: "link", originalName: "https://example.org", mimeType: "text/html", sizeBytes: 0, url: "https://example.org", position: 2, createdAt: "2026-10-01T00:00:00Z" },
];

// [syllabusLabels]: textos de estado del temario
export const syllabusLabels = { done: "Completado", current: "En curso", locked: "Bloqueado", pending: "Pendiente", lockedHint: "Completa la lección anterior", remove: "Quitar" };

// [generation]: traza de una generación con IA (modelo, tokens, latencia y banderas)
export const generation = {
  id: "gen-1",
  model: "qwen2.5:3b",
  modelDigest: "sha256:abc123",
  quantization: "Q4_K_M",
  parameterSize: "3B",
  promptTokens: 420,
  outputTokens: 610,
  latencyMs: 18_500,
  loadMs: 900,
  ramBytes: 2_100_000_000,
  vramBytes: null,
  promptVersion: "curriculum-v3",
  flags: { requiresReview: true, reasons: ["Contenido generado por IA"], contradiction: "none", reusable: true, llmRequired: true },
  content: {},
  createdAt: "2026-11-17T10:00:00Z",
} satisfies CurriculumGeneration;

// [noopAction]: Server Action simulada (éxito) → los botones de gestión funcionan sin servidor | `async` (JS): devuelve Promise como la real
export const okAction = async (): Promise<ActionResult> => ({ ok: true });
