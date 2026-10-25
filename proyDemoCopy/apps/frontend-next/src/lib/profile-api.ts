import { apiFetch } from "./api-client";
import { getCurrentAccessToken } from "./auth";

export interface ProfileData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  section: string | null;
  bio: string | null; // [2026-10-23]: preferencias del perfil guardadas en BD
  phone: string | null; // [2026-10-24]
  timezone: string | null;
  preferredLanguage: string | null;
  enrolledCourses: number; // Cursos con acceso
  level: string | null; // Nivel MCER (A1…C2) o null
  isActive: boolean;
  createdAt: string;
}

export async function getMyProfile(): Promise<ProfileData> {
  const token = await getCurrentAccessToken();
  return apiFetch<ProfileData>("/profile/me", {
    bearer: token ?? undefined,
  });
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  section?: string;
  bio?: string;
  phone?: string;
  timezone?: string;
  preferredLanguage?: string;
}

export async function updateMyProfile(input: UpdateProfileInput): Promise<ProfileData> {
  const token = await getCurrentAccessToken();
  return apiFetch<ProfileData>("/profile/me", {
    method: "PATCH",
    body: input,
    bearer: token ?? undefined,
  });
}

// [changeMyPassword · 2026-10-23]: POST /profile/me/password (verifica la actual en el backend) | [Patrón]: Facade
export async function changeMyPassword(currentPassword: string, newPassword: string): Promise<void> {
  const token = await getCurrentAccessToken();
  await apiFetch("/profile/me/password", {
    method: "POST",
    body: { currentPassword, newPassword },
    bearer: token ?? undefined,
  });
}
