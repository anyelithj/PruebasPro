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

// ─────────────── [Redes sociales del docente · 2026-10-28] ───────────────
// [Espejo del backend]: users/domain/value-objects/social-links.vo.ts (NestJS valida con la MISMA regla en `@OptionalSocialUrl`) | [Principio]: SSOT + DRY (lo usan Mi perfil y «Autoría del contenido» del curso)

// `as const` (TS): tupla de literales inmutable → orden de los iconos y tipo unión
export const SOCIAL_NETWORKS = ["linkedin", "twitter", "spotify", "youtube"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

// [Campo del formulario / PATCH /profile/me]: "linkedin" → "linkedinUrl" | Template literal type (TS 4.1)
export type SocialUrlField = `${SocialNetwork}Url`;
export const socialUrlField = (network: SocialNetwork): SocialUrlField => `${network}Url`;

// [Enlaces públicos]: null = red no configurada (la UI la oculta) | forma de `author.social` en GET /courses/:id
export type SocialLinks = Record<SocialNetwork, string | null>;

// [Metadatos por red]: nombre visible, dominios permitidos y ejemplo | [Patrón]: Lookup Table | [Principio]: OCP (nueva red = nueva entrada)
export const SOCIAL_META: Readonly<Record<SocialNetwork, { label: string; hosts: readonly string[]; placeholder: string }>> = {
  linkedin: { label: "LinkedIn", hosts: ["linkedin.com"], placeholder: "https://www.linkedin.com/in/tu-perfil" },
  twitter: { label: "X (Twitter)", hosts: ["x.com", "twitter.com"], placeholder: "https://x.com/tu_usuario" },
  spotify: { label: "Spotify", hosts: ["spotify.com"], placeholder: "https://open.spotify.com/show/…" },
  youtube: { label: "YouTube", hosts: ["youtube.com", "youtu.be"], placeholder: "https://www.youtube.com/@tu-canal" },
};

export const SOCIAL_URL_MAX_LENGTH = 255; // = `varchar(255)` de la migración UserSocialLinks1791993500000

// [isSocialUrl]: https + dominio exacto o subdominio de la red · sin credenciales embebidas | `new URL()` (WHATWG URL API) | [Seguridad]: bloquea `javascript:`/`data:` en el href
export function isSocialUrl(network: SocialNetwork, value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && SOCIAL_META[network].hosts.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false; // `new URL` lanza TypeError si el texto no es una URL
  }
}
