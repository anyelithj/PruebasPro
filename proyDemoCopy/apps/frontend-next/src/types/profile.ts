// [Tipos Profile]: SSOT del bounded context Profile en el frontend | [Principio]: SSOT, DRY

// [Niveles de estudio]: enum cerrado — debe alinear 1↔1 con backend EducationLevel
export type EducationLevel =
  | "PRIMARY"
  | "SECONDARY"
  | "TECHNICAL"
  | "UNDERGRADUATE"
  | "POSTGRADUATE"
  | "PHD"
  | "OTHER";

// [Etiquetas legibles]: lookup para UI | [Principio]: SSOT
export const EDUCATION_LEVEL_LABEL: Record<EducationLevel, string> = {
  PRIMARY: "Primaria",
  SECONDARY: "Secundaria / Bachillerato",
  TECHNICAL: "Técnico / Tecnólogo",
  UNDERGRADUATE: "Pregrado",
  POSTGRADUATE: "Posgrado",
  PHD: "Doctorado",
  OTHER: "Otro",
};

// [Respuesta GET /profile/me cuando existe]
export interface ProfileResponse {
  userId: string;
  fullName: string;
  email: string;
  dateOfBirth: string | null; // ISO date (YYYY-MM-DD)
  educationLevel: EducationLevel | null;
  productiveActivity: string | null;
  createdAt: string;
  updatedAt: string;
}

// [Respuesta GET /profile/me cuando NO existe]
export interface PendingProfileResponse {
  userId: string;
  pending: true;
}

export type ProfileMeResult = ProfileResponse | PendingProfileResponse;

export function isPendingProfile(result: ProfileMeResult): result is PendingProfileResponse {
  return (result as PendingProfileResponse).pending === true;
}

// [Input PUT /profile/me]
export interface UpdateProfileInput {
  fullName: string;
  dateOfBirth?: string | null; // YYYY-MM-DD
  educationLevel?: EducationLevel | null;
  productiveActivity?: string | null;
}
