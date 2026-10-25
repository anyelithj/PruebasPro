import { apiFetch } from "./api-client";
import { getCurrentAccessToken } from "./auth";
import type {
  Certification,
  CertificationPractice,
  CourseOutline,
  CurriculumItemView,
  CurriculumSource,
  LessonView,
  OutlineLevelInput,
  PaginatedCurriculum,
  ScanResult,
  TopicGroup,
} from "@/types/curriculum";
// [Facade server-side Curriculum]: funciones que los Server Components y el BFF usan para hablar con NestJS | [Patrón]: Facade + Adapter (BFF) | [Principio]: SRP + DRY | [Paradigma]: Funcional + async/await
// [Seguridad]: el token viaja desde la cookie httpOnly al backend en el servidor; el navegador nunca ve el JWT ni la URL del backend

// `async function` (ES2017): lee la cookie de sesión y la convierte en Bearer (undefined si no hay sesión)
async function bearer(): Promise<string | undefined> {
  return (await getCurrentAccessToken()) ?? undefined;
}

// `export interface` (TS): filtros aceptados por el listado (espejo de CurriculumFilterDto del backend)
export interface CurriculumFilters {
  language?: string;
  level?: string;
  skill?: string;
  kind?: string;
  status?: string;
  search?: string;
  topic?: string; // Tema exacto (página de un tema)
  perKind?: boolean; // Agrupar también por tipo (tabla de Gestión)
  page?: number;
  limit?: number;
}

// [toQuery]: solo las claves con valor → URL corta | `URLSearchParams` (Web API) | [Principio]: DRY
const toQuery = (filters: object) => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const q = qs.toString();
  return q ? `?${q}` : "";
};

// [Query]: GET /curriculum/by-topic → una tarjeta por tema (estudiantes: solo aprobados)
export async function listTopicGroups(filters: CurriculumFilters = {}): Promise<TopicGroup[]> {
  return apiFetch<TopicGroup[]>(`/curriculum/by-topic${toQuery(filters)}`, { bearer: await bearer() });
}

// [Query]: GET /curriculum con filtros → solo se envían los definidos (URL corta, caché de CDN posible)
export async function listCurriculum(filters: CurriculumFilters = {}): Promise<PaginatedCurriculum> {
  return apiFetch<PaginatedCurriculum>(`/curriculum${toQuery(filters)}`, { bearer: await bearer() });
}

// [Query]: GET /curriculum/:id (+ historial si el rol lo permite)
export async function getCurriculumItem(id: string): Promise<CurriculumItemView> {
  // `encodeURIComponent` (JS): evita inyección de rutas con caracteres especiales
  return apiFetch<CurriculumItemView>(`/curriculum/${encodeURIComponent(id)}`, { bearer: await bearer() });
}

// [Command]: POST /curriculum — `body: unknown` porque el BFF solo reenvía; la validación la hace el backend
export async function createCurriculumItem(body: unknown): Promise<unknown> {
  return apiFetch(`/curriculum`, { method: "POST", body, bearer: await bearer() });
}

// [Command]: PATCH /curriculum/:id (requiere expectedVersion en el body)
export async function updateCurriculumItem(id: string, body: unknown): Promise<unknown> {
  return apiFetch(`/curriculum/${encodeURIComponent(id)}`, { method: "PATCH", body, bearer: await bearer() });
}

// [Command]: DELETE /curriculum/:id — baja definitiva (solo ADMIN; el docente archiva)
export async function deleteCurriculumItem(id: string): Promise<unknown> {
  return apiFetch(`/curriculum/${encodeURIComponent(id)}`, { method: "DELETE", bearer: await bearer() });
}

// [Command]: POST /curriculum/:id/status
export async function changeCurriculumStatus(id: string, body: unknown): Promise<unknown> {
  return apiFetch(`/curriculum/${encodeURIComponent(id)}/status`, { method: "POST", body, bearer: await bearer() });
}

// [Command · Etapa 4]: POST /curriculum/contradictions/scan — compara fuentes y marca CONTRADICCION_DETECTADA
export async function scanContradictions(body: { language: string; kind?: string }): Promise<ScanResult> {
  return apiFetch<ScanResult>("/curriculum/contradictions/scan", { method: "POST", body, bearer: await bearer() });
}

// [Query]: GET /curriculum/sources — usado por las páginas para precargar "Contenido propio"
export async function searchCurriculumSources(params: { search?: string; limit?: number } = {}): Promise<CurriculumSource[]> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.limit) qs.set("limit", String(params.limit));
  const q = qs.toString();
  return apiFetch<CurriculumSource[]>(`/curriculum/sources${q ? `?${q}` : ""}`, { bearer: await bearer() });
}

// [Proxy genérico del catálogo]: GET/POST a /curriculum/{topics|sources|key-check} desde el BFF
export async function curriculumCatalogGet(path: "topics" | "sources" | "key-check", query: string): Promise<unknown> {
  return apiFetch(`/curriculum/${path}${query ? `?${query}` : ""}`, { bearer: await bearer() });
}

export async function curriculumCatalogPost(path: "topics" | "sources", body: unknown): Promise<unknown> {
  return apiFetch(`/curriculum/${path}`, { method: "POST", body, bearer: await bearer() });
}

// [Borradores con IA]: POST /curriculum/ai/{content|topics} — no persisten nada; el autor revisa y guarda | [Patrón]: Facade
// `"content" | "topics"` (TS union literal): solo rutas conocidas → sin rutas arbitrarias hacia el backend
export async function curriculumAiPost(action: "content" | "topics", body: unknown): Promise<unknown> {
  return apiFetch(`/curriculum/ai/${action}`, { method: "POST", body, bearer: await bearer() });
}

// ───── Etapa 3 · Estructura del curso y línea de tiempo ─────
const outlinePath = (courseId: string) => `/curriculum/courses/${encodeURIComponent(courseId)}`; // [DRY]: prefijo común

// [Query]: GET …/outline — árbol con progreso del usuario y siguiente lección
export async function getCourseOutline(courseId: string): Promise<CourseOutline> {
  return apiFetch<CourseOutline>(`${outlinePath(courseId)}/outline`, { bearer: await bearer() });
}

// [Command]: PUT …/outline — estructura primero (reutiliza recursos existentes)
export async function saveCourseOutline(courseId: string, levels: OutlineLevelInput[]): Promise<CourseOutline> {
  return apiFetch<CourseOutline>(`${outlinePath(courseId)}/outline`, { method: "PUT", body: { levels }, bearer: await bearer() });
}

// [Command]: POST …/lessons/:id/fill — genera SOLO si la lección está vacía
export async function fillLessonGap(courseId: string, lessonId: string, count = 5): Promise<{ created: number; reused: number }> {
  return apiFetch(`${outlinePath(courseId)}/lessons/${encodeURIComponent(lessonId)}/fill`, { method: "POST", body: { count }, bearer: await bearer() });
}

// [Query]: GET …/lessons/:id — contenido + anterior/siguiente
export async function getLesson(courseId: string, lessonId: string): Promise<LessonView> {
  return apiFetch<LessonView>(`${outlinePath(courseId)}/lessons/${encodeURIComponent(lessonId)}`, { bearer: await bearer() });
}

// [Command]: POST …/lessons/:id/complete — idempotente; devuelve la siguiente pendiente
export async function completeLesson(courseId: string, lessonId: string): Promise<{ nextLessonId: string | null }> {
  return apiFetch(`${outlinePath(courseId)}/lessons/${encodeURIComponent(lessonId)}/complete`, { method: "POST", bearer: await bearer() });
}

// ───── Etapa 5 · Certificaciones ─────
export async function listCertifications(language?: string): Promise<Certification[]> {
  const q = language ? `?language=${encodeURIComponent(language)}` : "";
  return apiFetch<Certification[]>(`/curriculum/certifications${q}`, { bearer: await bearer() });
}

export async function certificationPractice(id: string, body: { level: string; skill: string; kind: string; count: number }): Promise<CertificationPractice> {
  return apiFetch<CertificationPractice>(`/curriculum/certifications/${encodeURIComponent(id)}/practice`, { method: "POST", body, bearer: await bearer() });
}
