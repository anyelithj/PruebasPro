"use server"; // [Next.js]: directiva que convierte cada export en Server Action (se ejecuta solo en el servidor)
import { revalidatePath } from "next/cache"; // [Next.js]: invalida la caché de una ruta tras una mutación
import { z } from "zod"; // [Zod]: validación de esquemas en runtime con inferencia de tipos TS
import { changeMyPassword, setTwoFactor, updateMyProfile } from "@/lib/profile-api"; // [Facade]: cliente del backend NestJS PATCH /profile/me
import { fmt, type Dictionary } from "@aula/shared-i18n";
import { optionalPhone } from "@/lib/validations"; // [2026-10-24]: regla de teléfono compartida (registro, perfil y Gestión) | [Principio]: DRY
import { getServerDictionary } from "@/lib/i18n-server"; // [i18n]: mensajes en el idioma del usuario (cookie ui-lang)
import { isSocialUrl, SOCIAL_META, SOCIAL_NETWORKS, SOCIAL_URL_MAX_LENGTH, socialUrlField, type SocialNetwork } from "@/types/profile"; // [2026-10-28]: regla única de redes sociales (espejo de NestJS)
// [Server Action perfil]: valida FormData y actualiza el perfil propio | [Patrón]: Command | [Principio]: SRP | [Paradigma]: Funcional + asíncrono
// [Por qué]: profile-api usa `cookies()` de next/headers (solo servidor); antes se llamaba desde un Client Component y rompía la página

// [Esquema]: misma regla que el backend (máx 80/80/40) con mensajes traducidos | [Patrón]: Factory (esquema por idioma)
function buildProfileSchema(t: Dictionary) {
  const max = (n: number) => fmt(t.common.max, { n }); // Closure (JS): mensaje con el límite concreto
  // [social · 2026-10-28]: esquema por red → "" (borrar) o URL https del dominio de la red | `refine` (Zod): regla propia con mensaje traducido | [Principio]: DRY (4 campos, 1 regla)
  const social = (n: SocialNetwork) =>
    z
      .string()
      .trim()
      .max(SOCIAL_URL_MAX_LENGTH, max(SOCIAL_URL_MAX_LENGTH))
      .refine((v) => v === "" || isSocialUrl(n, v), fmt(t.profile.socialInvalid, { network: SOCIAL_META[n].label, hosts: SOCIAL_META[n].hosts.join(" / ") }))
      .optional(); // `optional`: los estudiantes no ven estos campos → no llegan en el FormData
  return z.object({
    firstName: z.string().trim().min(1, t.common.required).max(80, max(80)), // `trim` limpia espacios antes de validar
    lastName: z.string().trim().min(1, t.common.required).max(80, max(80)),
    section: z.string().trim().max(40, max(40)).optional(), // `optional` (Zod): docente/admin no envían sección
    bio: z.string().trim().max(300, max(300)).optional(), // [2026-10-23]: preferencias ahora en BD
    phone: optionalPhone({ phoneInvalid: t.profile.phoneInvalid }), // [2026-10-24]: misma regla que NestJS (PHONE_PATTERN de @aula/shared-schemas)
    timezone: z.string().trim().max(64).optional(),
    preferredLanguage: z.enum(["es", "en", "pt"]).optional(),
    linkedinUrl: social("linkedin"), // [2026-10-28]: redes sociales del docente
    twitterUrl: social("twitter"),
    spotifyUrl: social("spotify"),
    youtubeUrl: social("youtube"),
  });
}

// [Estado del formulario]: contrato entre la action y useActionState | `export type` (TS): tipo público, no genera JS
export type ProfileFormState = {
  status: "idle" | "success" | "error"; // [Union literal TS]: solo estos 3 valores son válidos (tipado seguro)
  message?: string; // `?` (TS): propiedad opcional
  language?: string; // [2026-10-23]: idioma preferido guardado → el cliente lo aplica a la UI si es es/en
  fieldErrors?: Partial<Record<keyof z.infer<ReturnType<typeof buildProfileSchema>>, string>>; // [TS utility types]: error por campo, todos opcionales
};

// `export async function` (ES2017): función asíncrona exportada; React la invoca con (estadoPrevio, FormData)
export async function updateProfileAction(
  _prev: ProfileFormState, // `_` prefijo: parámetro requerido por la firma de useActionState pero no usado
  formData: FormData, // [Web API]: datos nativos del <form>, funciona incluso sin JavaScript (progressive enhancement)
): Promise<ProfileFormState> {
  // `safeParse` (Zod): valida sin lanzar excepción → devuelve { success, data | error }
  const t = await getServerDictionary();
  const parsed = buildProfileSchema(t).safeParse({
    firstName: formData.get("firstName") ?? "", // `??` (ES2020): string vacío si el campo no llegó
    lastName: formData.get("lastName") ?? "",
    section: formData.get("section") ?? undefined, // undefined si el input no se renderizó (no estudiante)
    bio: formData.get("bio") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    timezone: formData.get("timezone") ?? undefined,
    preferredLanguage: formData.get("preferredLanguage") ?? undefined,
    // [2026-10-28]: `Object.fromEntries` (ES2019) + `map` → las 4 redes sin repetir código | undefined si el campo no se renderizó (estudiante)
    ...Object.fromEntries(SOCIAL_NETWORKS.map((n) => [socialUrlField(n), formData.get(socialUrlField(n)) ?? undefined])),
  });

  if (!parsed.success) {
    // `z.flattenError` (Zod 4): { fieldErrors: { campo: string[] } } → tomamos el primer mensaje de cada campo
    const f = z.flattenError(parsed.error).fieldErrors;
    return {
      status: "error",
      message: t.profile.fixFields,
      fieldErrors: {
        firstName: f.firstName?.[0],
        lastName: f.lastName?.[0],
        section: f.section?.[0],
        phone: f.phone?.[0],
        ...Object.fromEntries(SOCIAL_NETWORKS.map((n) => [socialUrlField(n), f[socialUrlField(n)]?.[0]])), // [2026-10-28]: error por red social
      }, // `?.[0]` (ES2020): acceso seguro
    };
  }

  try {
    await updateMyProfile({ ...parsed.data, section: parsed.data.section || undefined }); // `...` spread (ES2018) | "" → undefined: no pisar con vacío (bio "" sí borra)
  } catch (err) {
    // `instanceof` (JS): estrecha el tipo unknown a Error para leer .message de forma segura
    return { status: "error", message: err instanceof Error ? err.message : t.profile.saveError };
  }

  revalidatePath("/profile/edit"); // [Next.js]: el próximo render trae los datos recién guardados
  return { status: "success", message: t.profile.saved, language: parsed.data.preferredLanguage };
}

// [Estado del cambio de contraseña · 2026-10-23]: mismo contrato que el perfil | [Principio]: DRY (mismo patrón useActionState)
export type PasswordFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"currentPassword" | "newPassword" | "confirmPassword", string>>;
};

// [changePasswordAction]: valida fortaleza + confirmación y llama POST /profile/me/password | [Patrón]: Command | [Seguridad]: la contraseña actual se verifica en el backend (bcrypt)
export async function changePasswordAction(_prev: PasswordFormState, formData: FormData): Promise<PasswordFormState> {
  const t = await getServerDictionary();
  const p = t.profile;
  // [Esquema]: misma regla que el backend (8+, mayúscula, minúscula, dígito) | `refine` (Zod): regla entre campos
  const parsed = z
    .object({
      currentPassword: z.string().min(1, t.common.required),
      newPassword: z.string().min(8, p.passwordRule).max(128).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, p.passwordRule),
      confirmPassword: z.string(),
    })
    .refine((d) => d.newPassword === d.confirmPassword, { path: ["confirmPassword"], message: p.passwordMismatch })
    .safeParse(Object.fromEntries(["currentPassword", "newPassword", "confirmPassword"].map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) {
    const f = z.flattenError(parsed.error).fieldErrors;
    return { status: "error", message: t.profile.fixFields, fieldErrors: { currentPassword: f.currentPassword?.[0], newPassword: f.newPassword?.[0], confirmPassword: f.confirmPassword?.[0] } };
  }
  try {
    await changeMyPassword(parsed.data.currentPassword, parsed.data.newPassword);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : t.profile.saveError };
  }
  return { status: "success", message: p.passwordChanged };
}

// [Estado del 2FA · 2026-11-16]: contrato con useActionState | `enabled` = estado tras la acción (la tarjeta lo pinta sin recargar)
export type TwoFactorFormState = { status: "idle" | "success" | "error"; message?: string; enabled?: boolean };

// [toggleTwoFactorAction · 2026-11-16]: activa/desactiva el 2FA con la contraseña actual → PATCH /auth/2fa | [Patrón]: Command (Server Action) | [Seguridad]: la contraseña se verifica en NestJS (bcrypt)
export async function toggleTwoFactorAction(_prev: TwoFactorFormState, formData: FormData): Promise<TwoFactorFormState> {
  const t = await getServerDictionary();
  const password = String(formData.get("password") ?? "");
  const enabled = formData.get("enabled") === "true"; // Campo oculto: estado DESEADO (contrario al actual)
  if (!password) return { status: "error", message: t.common.required };
  try {
    const res = await setTwoFactor(enabled, password);
    return { status: "success", enabled: res.enabled, message: res.enabled ? t.profile.twoFactorEnabled : t.profile.twoFactorDisabled };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : t.profile.saveError };
  }
}
