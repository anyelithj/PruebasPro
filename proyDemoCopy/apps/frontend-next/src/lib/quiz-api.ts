import { apiFetch } from "./api-client";
import { getCurrentAccessToken } from "./auth";
import type {
  CreateQuizInput,
  MyHistoryItem,
  PaginatedQuizzes,
  Quiz,
  QuizSession,
  SubmitAnswerInput,
  LeaderboardEntry,
  ScoreEntry,
} from "@/types/quiz";
// [Wrappers API Quiz/Score]: facade server-side hacia NestJS | [Patron]: Facade + Adapter | [Principio]: SRP + DRY | [Paradigma]: Funcional

// [Helper bearer]: lee cookie httpOnly y la pasa al backend | [Principio]: SSOT
async function withBearer() {
  const token = await getCurrentAccessToken();
  return token ?? undefined;
}

// ===== Quiz =====
export async function listQuizzes(params: {
  page?: number;
  limit?: number;
  category?: string;
  difficulty?: string;
  // [publishedOnly]: false → incluye borradores (panel docente) | [Principio]: ISP
  publishedOnly?: boolean;
} = {}): Promise<PaginatedQuizzes> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.category) qs.set("category", params.category);
  if (params.difficulty) qs.set("difficulty", params.difficulty);
  if (params.publishedOnly !== undefined)
    qs.set("publishedOnly", String(params.publishedOnly));
  const q = qs.toString();
  return apiFetch<PaginatedQuizzes>(`/quiz${q ? `?${q}` : ""}`, {
    bearer: await withBearer(),
  });
}

// [getMyHistory]: historial académico del estudiante autenticado | [Patrón]: Facade
export async function getMySessionsHistory(limit = 20): Promise<MyHistoryItem[]> {
  return apiFetch<MyHistoryItem[]>(`/quiz/sessions/me?limit=${limit}`, {
    bearer: await withBearer(),
  });
}

// [getUserHistory]: docente/admin consulta historial de cualquier estudiante | [Patrón]: Facade | [Principio]: Least Privilege (backend valida TEACHER+)
export async function getUserSessionsHistory(
  userId: string,
  limit = 50,
): Promise<MyHistoryItem[]> {
  return apiFetch<MyHistoryItem[]>(
    `/quiz/sessions/by-user/${userId}?limit=${limit}`,
    { bearer: await withBearer() },
  );
}

// [listStudents]: docente lista alumnos para seguimiento académico (solo role=USER) | [Patrón]: Facade
export interface StudentListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "USER" | "TEACHER" | "ADMIN";
  isActive: boolean;
  createdAt: string;
  section?: string | null;
}
export interface PaginatedStudents {
  data: StudentListItem[];
  total: number;
  page: number;
  limit: number;
}
// [getStudent]: detalle de un estudiante (TEACHER+) sin requerir ADMIN
export async function getStudent(userId: string): Promise<StudentListItem> {
  return apiFetch<StudentListItem>(`/users/students/${userId}`, {
    bearer: await withBearer(),
  });
}

export async function listStudents(
  params: { page?: number; limit?: number; search?: string; section?: string } = {},
): Promise<PaginatedStudents> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.search) qs.set("search", params.search);
  if (params.section) qs.set("section", params.section);
  const q = qs.toString();
  return apiFetch<PaginatedStudents>(`/users/students${q ? `?${q}` : ""}`, {
    bearer: await withBearer(),
  });
}

export async function getQuiz(id: string): Promise<Quiz> {
  return apiFetch<Quiz>(`/quiz/${id}`, { bearer: await withBearer() });
}

// [Crear quiz]: POST /quiz | [Patrón]: Facade | [Principio]: SRP
export async function createQuiz(input: CreateQuizInput): Promise<Quiz> {
  return apiFetch<Quiz>(`/quiz`, {
    method: "POST",
    body: input,
    bearer: await withBearer(),
  });
}

export async function patchQuiz(id: string, partial: Partial<{ title: string; description: string; isPublished: boolean; timePerQuestionSeconds: number }>): Promise<Quiz> {
  return apiFetch<Quiz>(`/quiz/${id}`, {
    method: "PATCH",
    body: partial,
    bearer: await withBearer(),
  });
}

export async function deleteQuiz(id: string): Promise<void> {
  await apiFetch<void>(`/quiz/${id}`, {
    method: "DELETE",
    bearer: await withBearer(),
  });
}

export async function reactivateUser(userId: string): Promise<void> {
  await apiFetch<void>(`/users/${userId}/activate`, {
    method: "POST",
    body: {},
    bearer: await withBearer(),
  });
}

export async function startSession(quizId: string): Promise<QuizSession> {
  return apiFetch<QuizSession>(`/quiz/${quizId}/session`, {
    method: "POST",
    body: {},
    bearer: await withBearer(),
  });
}

export async function submitAnswer(
  sessionId: string,
  input: SubmitAnswerInput,
): Promise<{ session: QuizSession; isCorrect: boolean; score: number }> {
  return apiFetch(`/quiz/session/${sessionId}/answer`, {
    method: "POST",
    body: input,
    bearer: await withBearer(),
  });
}

export async function endSession(
  sessionId: string,
  abandon = false,
): Promise<QuizSession> {
  return apiFetch<QuizSession>(
    `/quiz/session/${sessionId}/end${abandon ? "?abandon=true" : ""}`,
    {
      method: "POST",
      body: {},
      bearer: await withBearer(),
    },
  );
}

// ===== Score =====
// [getLeaderboard]: top N filtrable por periodo (meses) y sección | [Patrón]: Facade
export async function getLeaderboard(
  limit = 10,
  opts: { months?: number; section?: string } = {},
): Promise<{ entries: LeaderboardEntry[] }> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (opts.months) qs.set("months", String(opts.months));
  if (opts.section) qs.set("section", opts.section);
  return apiFetch<{ entries: LeaderboardEntry[] }>(
    `/score/leaderboard?${qs.toString()}`,
    { bearer: await withBearer() },
  );
}

// [getMyHistory]: historial de puntajes propio, filtrable por periodo | [Patrón]: Facade
export async function getMyHistory(limit = 20, months?: number): Promise<ScoreEntry[]> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (months) qs.set("months", String(months));
  return apiFetch<ScoreEntry[]>(`/score/history?${qs.toString()}`, {
    bearer: await withBearer(),
  });
}

// [getSections]: secciones distintas para poblar filtros (TEACHER+) | [Patrón]: Lookup
export async function getSections(): Promise<{ sections: string[] }> {
  return apiFetch<{ sections: string[] }>(`/users/sections`, {
    bearer: await withBearer(),
  });
}

// ===== Admin Users =====
export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "USER" | "TEACHER" | "ADMIN";
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  section?: string | null;
  phone?: string | null; // [2026-10-24]
}

export interface PaginatedUsers {
  data: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

export async function listUsers(params: { page?: number; limit?: number; role?: string; search?: string; section?: string } = {}): Promise<PaginatedUsers> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.role) qs.set("role", params.role);
  if (params.search) qs.set("search", params.search);
  if (params.section) qs.set("section", params.section);
  const q = qs.toString();
  return apiFetch<PaginatedUsers>(`/users${q ? `?${q}` : ""}`, { bearer: await withBearer() });
}

export async function getUserStats(): Promise<{ total: number; byRole: Record<string, number> }> {
  return apiFetch(`/users/stats`, { bearer: await withBearer() });
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "USER" | "TEACHER" | "ADMIN";
  section?: string;
}

export async function createUser(input: CreateUserInput): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/users`, {
    method: "POST",
    body: input,
    bearer: await withBearer(),
  });
}

export async function deactivateUser(userId: string): Promise<void> {
  await apiFetch<void>(`/users/${userId}`, {
    method: "DELETE",
    bearer: await withBearer(),
  });
}

export async function getUser(userId: string): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/users/${userId}`, { bearer: await withBearer() });
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  role?: "USER" | "TEACHER" | "ADMIN";
  section?: string;
}

export async function updateUser(userId: string, input: UpdateUserInput): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/users/${userId}`, {
    method: "PATCH",
    body: input,
    bearer: await withBearer(),
  });
}
