import { apiFetch } from "./api-client";
import { getCurrentAccessToken } from "./auth";
import {
  LANGUAGE_GROUPS,
  type CourseResponse,
  type PaginatedCoursesResponse,
  type CourseFilterInput,
  type LanguageGroup,
  type ReactionKind,
} from "@/types/courses";
// [Wrapper API Courses]: facade server-side hacia NestJS /courses | [Patrón]: Facade + Adapter | [Principio]: SRP + DRY | [Paradigma]: Funcional

// [Helper bearer]: lee cookie httpOnly y la pasa al backend | [Principio]: SSOT
async function withBearer(): Promise<string | undefined> {
  const token = await getCurrentAccessToken();
  return token ?? undefined;
}

// [GET /courses]: listado paginado con filtros | [Patrón]: Facade
export async function listCourses(
  filter: CourseFilterInput = {},
): Promise<PaginatedCoursesResponse> {
  const qs = new URLSearchParams();
  if (filter.group) qs.set("group", filter.group);
  if (filter.category) qs.set("category", filter.category);
  if (filter.eje) qs.set("eje", String(filter.eje));
  if (filter.search) qs.set("search", filter.search);
  if (filter.isProBono !== undefined) qs.set("isProBono", String(filter.isProBono));
  if (filter.page) qs.set("page", String(filter.page));
  if (filter.limit) qs.set("limit", String(filter.limit));
  const q = qs.toString();
  return apiFetch<PaginatedCoursesResponse>(`/courses${q ? `?${q}` : ""}`, {
    bearer: await withBearer(),
  });
}

// [Conteo público por idioma]: cursos publicados de cada grupo para la landing | [Patrón]: Facade + Graceful Degradation | [Principio]: SRP
// `Promise.allSettled` (ES2020): un idioma que falle no tumba la página → ese idioma simplemente no muestra conteo
export async function countPublishedByGroup(): Promise<Partial<Record<LanguageGroup, number>>> {
  const results = await Promise.allSettled(
    // `limit=1` (API): solo interesa `total`, no los cursos → respuesta mínima | sin `bearer`: GET /courses es @Public()
    LANGUAGE_GROUPS.map((group) => apiFetch<PaginatedCoursesResponse>(`/courses?group=${group}&limit=1`)),
  );
  // `Object.fromEntries` (ES2019) + `flatMap` (ES2019): [grupo, total] solo de las respuestas exitosas
  return Object.fromEntries(
    results.flatMap((r, i) => (r.status === "fulfilled" ? [[LANGUAGE_GROUPS[i], r.value.total]] : [])),
  );
}

// [GET /courses/:idOrSlug]: detalle | [Patrón]: Facade
export async function getCourse(idOrSlug: string): Promise<CourseResponse> {
  return apiFetch<CourseResponse>(`/courses/${encodeURIComponent(idOrSlug)}`, {
    bearer: await withBearer(),
  });
}

// [POST /courses/:id/favorite]: alterna favorito (requiere sesión) | [Patrón]: Command
export async function toggleFavorite(courseId: string): Promise<{ isFavorite: boolean }> {
  return apiFetch<{ isFavorite: boolean }>(`/courses/${courseId}/favorite`, {
    method: "POST",
    body: {},
    bearer: await withBearer(),
  });
}

// [POST /courses/:id/reaction]: alterna like/love/favorite | [Patrón]: Command + Strategy
export async function toggleReaction(
  courseId: string,
  kind: ReactionKind,
): Promise<{ like: boolean; love: boolean; favorite: boolean }> {
  return apiFetch<{ like: boolean; love: boolean; favorite: boolean }>(
    `/courses/${courseId}/reaction`,
    {
      method: "POST",
      body: { kind },
      bearer: await withBearer(),
    },
  );
}

// ───────────────────────── ADMIN ─────────────────────────

// [Input alta admin]: alinea con backend CreateCourseDto | [Principio]: SSOT
export interface CreateCourseInput {
  title: string;
  slug: string;
  shortDescription: string;
  description?: string | null;
  category: import("@/types/courses").CourseCategory;
  group?: import("@/types/courses").CourseGroup; // [Idioma del curso]: el backend lo acepta (ACTIVE_COURSE_GROUPS) y es clave para el filtro del catálogo
  instructor: string;
  instructorTitle?: string | null;
  color?: string;
  icon?: string;
  tags?: string[];
  eje?: number;
  lab?: string | null;
  price?: number;
  originalPrice?: number | null;
  currency?: string;
  durationHours?: number;
  level?: string;
  rating?: number;
  studentsCount?: number;
  modality?: string;
  isProBono?: boolean;
  isPublished?: boolean;
}

export type UpdateCourseInput = Partial<CreateCourseInput>;

// [GET /courses/admin]: listado admin (incluye borradores) | [Patrón]: Facade
export async function listCoursesAdmin(
  filter: CourseFilterInput = {},
): Promise<PaginatedCoursesResponse> {
  const qs = new URLSearchParams();
  if (filter.group) qs.set("group", filter.group);
  if (filter.category) qs.set("category", filter.category);
  if (filter.eje) qs.set("eje", String(filter.eje));
  if (filter.search) qs.set("search", filter.search);
  if (filter.isProBono !== undefined) qs.set("isProBono", String(filter.isProBono));
  if (filter.page) qs.set("page", String(filter.page));
  if (filter.limit) qs.set("limit", String(filter.limit));
  const q = qs.toString();
  return apiFetch<PaginatedCoursesResponse>(`/courses/admin${q ? `?${q}` : ""}`, {
    bearer: await withBearer(),
  });
}

// [POST /courses]: crear curso (ADMIN) | [Patrón]: Command
export async function createCourse(input: CreateCourseInput): Promise<CourseResponse> {
  return apiFetch<CourseResponse>(`/courses`, {
    method: "POST",
    body: input,
    bearer: await withBearer(),
  });
}

// [PATCH /courses/:id]: editar curso (ADMIN) | [Patrón]: Command
export async function updateCourse(
  id: string,
  patch: UpdateCourseInput,
): Promise<CourseResponse> {
  return apiFetch<CourseResponse>(`/courses/${id}`, {
    method: "PATCH",
    body: patch,
    bearer: await withBearer(),
  });
}

// [DELETE /courses/:id]: baja dura (ADMIN) | [Patrón]: Command
export async function deleteCourse(id: string): Promise<{ deleted: true; id: string }> {
  return apiFetch<{ deleted: true; id: string }>(`/courses/${id}`, {
    method: "DELETE",
    bearer: await withBearer(),
  });
}

// [PATCH /courses/:id/publish]: activar/desactivar (ADMIN — baja blanda) | [Patrón]: Command
export async function setCoursePublished(
  id: string,
  isPublished: boolean,
): Promise<CourseResponse> {
  return apiFetch<CourseResponse>(`/courses/${id}/publish`, {
    method: "PATCH",
    body: { isPublished },
    bearer: await withBearer(),
  });
}

// [GET /courses/:id/materials]: videos y PDF del curso (Server Components) | [Patrón]: Facade
export async function listCourseMaterials(courseId: string): Promise<import("@/types/courses").CourseMaterial[]> {
  return apiFetch(`/courses/${encodeURIComponent(courseId)}/materials`, { bearer: await withBearer() });
}

// [POST /courses/:id/purchase]: compra (simulada) o inscripción → desbloquea el material | [Patrón]: Command
export async function purchaseCourse(courseId: string): Promise<{ courseId: string; hasAccess: true; purchasedAt: string }> {
  return apiFetch(`/courses/${encodeURIComponent(courseId)}/purchase`, { method: "POST", body: {}, bearer: await withBearer() });
}

// [POST /courses/:id/materials/:mid/complete]: marca un material como visto → progreso recalculado en el backend | [Patrón]: Command
export async function completeMaterial(courseId: string, materialId: string): Promise<{ completedMaterialIds: string[]; progress: number }> {
  return apiFetch(`/courses/${encodeURIComponent(courseId)}/materials/${encodeURIComponent(materialId)}/complete`, { method: "POST", body: {}, bearer: await withBearer() });
}
