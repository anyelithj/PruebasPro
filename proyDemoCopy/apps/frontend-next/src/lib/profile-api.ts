import { apiFetch } from "./api-client";
import { getCurrentAccessToken } from "./auth";
import type { SocialUrlField } from "@/types/profile"; // [2026-10-28]: linkedinUrl/twitterUrl/spotifyUrl/youtubeUrl

export type ProfileData = {
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
} & Partial<Record<SocialUrlField, string | null>>; // [2026-10-28]: redes sociales (null = sin configurar) | `Partial`: backend anterior sin los campos

export async function getMyProfile(): Promise<ProfileData> {
  const token = await getCurrentAccessToken();
  return apiFetch<ProfileData>("/profile/me", {
    bearer: token ?? undefined,
  });
}

export type UpdateProfileInput = {
  firstName?: string;
  lastName?: string;
  section?: string;
  bio?: string;
  phone?: string;
  timezone?: string;
  preferredLanguage?: string;
} & Partial<Record<SocialUrlField, string>>; // [2026-10-28]: "" = borrar el enlace (igual que bio/teléfono)

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

// [getTwoFactor · 2026-11-16]: GET /auth/2fa → estado del segundo factor del usuario actual | [Patrón]: Facade
export async function getTwoFactor(): Promise<{ enabled: boolean }> {
  const token = await getCurrentAccessToken();
  return apiFetch<{ enabled: boolean }>("/auth/2fa", { bearer: token ?? undefined });
}

// [setTwoFactor · 2026-11-16]: PATCH /auth/2fa (NestJS exige la contraseña actual) | [Seguridad]: reautenticación
export async function setTwoFactor(enabled: boolean, password: string): Promise<{ enabled: boolean }> {
  const token = await getCurrentAccessToken();
  return apiFetch<{ enabled: boolean }>("/auth/2fa", {
    method: "PATCH",
    body: { enabled, password },
    bearer: token ?? undefined,
  });
}
