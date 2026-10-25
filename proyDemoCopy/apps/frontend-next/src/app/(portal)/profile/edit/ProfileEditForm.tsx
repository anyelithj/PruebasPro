"use client"; // [Next.js]: Client Component → necesario para hooks de React (useActionState) e interactividad
import { useActionState, useEffect, useRef } from "react"; // [React 19]: conecta un <form> con una Server Action y expone estado + pending | useEffect: aplica el idioma guardado a la UI
import { isLocale } from "@aula/shared-i18n"; // [Type guard]: ¿el idioma preferido es también idioma de la interfaz (es/en)?
import { usePreferences } from "@/components/layout/PreferencesProvider";
import { updateProfileAction, type ProfileFormState } from "./actions"; // [Server Action]: mutación en el servidor
// [ProfileEditForm]: tarjeta "Datos personales" de NeuroLearning (cabecera con avatar + estadísticas + campos + Guardar datos) | [Patrón]: Presentational + Uncontrolled inputs (defaultValue del servidor) | [Principio]: SRP + KISS | [Paradigma]: Declarativo

// `interface` (TS): contrato de props; el servidor pasa los valores iniciales | [Principio]: ISP (solo lo necesario)
interface ProfileEditFormProps {
  firstName: string;
  lastName: string;
  email: string;
  roleLabel: string; // Rol ya traducido ("Estudiante")
  section: string | null; // `| null` (TS union): el backend devuelve null si no hay sección
  isStudent: boolean; // [Regla de negocio]: solo estudiantes tienen sección/grupo, cursos y nivel
  phone: string | null; // [2026-10-24]: teléfono opcional
  bio: string | null; // [2026-10-23]: preferencias en BD (antes localStorage → el <select> se reseteaba al enviar el form)
  timezone: string | null;
  preferredLanguage: string | null;
  enrolledCourses: number;
  level: string | null;
}

const TIMEZONES = ["America/Bogota", "America/Lima", "America/Mexico_City", "America/Argentina/Buenos_Aires", "Europe/Madrid"] as const; // IANA (tz database)
const PREFERRED_LANGUAGES = ["es", "en", "pt"] as const;

// `const` (ES2015) tipado con ProfileFormState: estado inicial del formulario (antes del primer envío), fuera del componente para no recrearlo
const INITIAL_STATE: ProfileFormState = { status: "idle" };

// [Clase de control]: estilo de input del original (surf2 + borde de tema) | [Principio]: DRY (7 controles)
const controlClass =
  "w-full rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive read-only:opacity-70";

// [initials]: "Ana Pérez" → "AP" | [Paradigma]: Funcional (pura) | `?.` + `??` (ES2020): tolera nombres vacíos
const initials = (a: string, b: string) => `${a.trim()[0] ?? ""}${b.trim()[0] ?? ""}`.toUpperCase() || "?";

export function ProfileEditForm({ firstName, lastName, email, roleLabel, section, isStudent, phone, bio, timezone, preferredLanguage, enrolledCourses, level }: ProfileEditFormProps) {
  const { t, locale, setLocale } = usePreferences();
  const p = t.profile; // Alias de textos del perfil
  // [useActionState]: [estadoDevuelto, actionParaElForm, pending] | reemplaza varios useState + useCallback
  const [state, formAction, pending] = useActionState(updateProfileAction, INITIAL_STATE);
  const errors = state.fieldErrors ?? {}; // `??` (ES2020): objeto vacío si no hay errores por campo

  // [Sincronización]: al guardar un idioma que la UI soporta (es/en), la interfaz cambia también | [Patrón]: Observer (efecto sobre el resultado de la action)
  // `useRef` (React): recuerda el último resultado aplicado → cambiar el idioma luego desde el topbar no lo revierte
  const applied = useRef(state);
  useEffect(() => {
    if (applied.current === state) return;
    applied.current = state;
    if (state.status === "success" && isLocale(state.language) && state.language !== locale) setLocale(state.language);
  }, [state, locale, setLocale]);

  return (
    <section aria-labelledby="personal-title" className="rounded-[14px] border border-border bg-card p-[18px] shadow-[var(--nl-shd)]">
      <h2 id="personal-title" className="sr-only">
        {p.title}
      </h2>

      {/* Cabecera con avatar: iniciales sobre el degradado morado de marca */}
      <div className="mb-4 flex items-center gap-3 rounded-xl bg-muted p-3">
        <div className="grid size-[52px] shrink-0 place-items-center rounded-full bg-gradient-brand text-lg font-bold text-white" aria-hidden>
          {initials(firstName, lastName)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">
            {firstName} {lastName}
          </div>
          <div className="break-all text-[11px] text-muted-foreground">
            {email} • {roleLabel}
          </div>
        </div>
      </div>

      {/* [Estadísticas de aprendizaje]: solo estudiantes | <dl> semántico (término → valor) | [a11y] */}
      {isStudent && (
        <dl className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border p-3">
            <dt className="text-[11px] font-semibold text-muted-foreground">{p.enrolledCourses}</dt>
            <dd className="text-xl font-extrabold">{enrolledCourses}</dd>
          </div>
          <div className="rounded-xl border border-border p-3">
            <dt className="text-[11px] font-semibold text-muted-foreground">{p.level}</dt>
            <dd className="text-xl font-extrabold">{level ?? <span className="text-sm font-semibold text-muted-foreground">{p.noLevel}</span>}</dd>
          </div>
        </dl>
      )}

      {/* `action={formAction}` (React 19): envía FormData a la Server Action; funciona sin JS (progressive enhancement) */}
      <form action={formAction} noValidate>
        {state.message && (
          // [Mensaje global]: role/aria-live → los lectores de pantalla anuncian el resultado (WCAG 4.1.3)
          <div
            role={state.status === "error" ? "alert" : "status"}
            aria-live="polite"
            className={
              state.status === "error"
                ? "mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                : "mb-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary"
            }
          >
            {state.message}
          </div>
        )}

        <div className="mb-[14px] flex flex-col gap-[9px]">
          {/* [Responsive]: nombre y apellido en 2 columnas desde sm */}
          <div className="grid gap-[9px] sm:grid-cols-2">
            <Field id="firstName" label={p.firstName} error={errors.firstName} required>
              <input id="firstName" name="firstName" autoComplete="given-name" defaultValue={firstName} maxLength={80} required className={controlClass} {...ariaFor("firstName", errors.firstName)} />
            </Field>
            <Field id="lastName" label={p.lastName} error={errors.lastName} required>
              <input id="lastName" name="lastName" autoComplete="family-name" defaultValue={lastName} maxLength={80} required className={controlClass} {...ariaFor("lastName", errors.lastName)} />
            </Field>
          </div>

          <Field id="email" label={p.email} hint={p.emailHint}>
            {/* readOnly (HTML): visible y copiable pero no editable; no se envía cambio al backend */}
            <input id="email" type="email" value={email} readOnly className={controlClass} aria-describedby="email-hint" />
          </Field>

          {/* [Teléfono · 2026-10-24]: `type="tel"` (HTML) → teclado telefónico en móvil | error del servidor bajo el campo */}
          <Field id="phone" label={p.phone} hint={p.phoneHint} error={errors.phone}>
            <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={phone ?? ""} maxLength={20} placeholder="+57 300 123 4567" className={controlClass} {...ariaFor("phone", errors.phone)} />
          </Field>

          {/* [Uncontrolled + name]: viajan en el FormData; tras guardar, React restablece al nuevo defaultValue del servidor (no al valor viejo) */}
          <Field id="bio" label={p.bio}>
            <textarea id="bio" name="bio" rows={2} maxLength={300} defaultValue={bio ?? ""} placeholder={p.bioPlaceholder} className={`${controlClass} resize-none`} />
          </Field>

          <div className="grid gap-[9px] sm:grid-cols-2">
            <Field id="timezone" label={p.timezone}>
              <select id="timezone" name="timezone" defaultValue={timezone ?? "America/Bogota"} className={controlClass}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")} {/* `replace` con regex global: "Buenos_Aires" → "Buenos Aires" */}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="preferredLanguage" label={p.preferredLanguage}>
              <select id="preferredLanguage" name="preferredLanguage" defaultValue={preferredLanguage ?? locale} className={controlClass}>
                {PREFERRED_LANGUAGES.map((code) => (
                  <option key={code} value={code}>
                    {p.preferredLanguages[code] ?? code}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* [Renderizado condicional]: `&&` (JS) → solo estudiantes ven el campo sección */}
          {isStudent && (
            <Field id="section" label={p.section} hint={p.sectionHint} error={errors.section}>
              <input id="section" name="section" defaultValue={section ?? ""} maxLength={40} placeholder={p.sectionPlaceholder} className={controlClass} aria-describedby="section-hint" {...ariaFor("section", errors.section)} />
            </Field>
          )}
        </div>

        {/* [UX]: deshabilitado + texto de progreso mientras la action corre; aria-busy para tecnologías asistivas */}
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="btn btn-primary w-full"
        >
          {pending ? p.saving : p.save}
        </button>
      </form>
    </section>
  );
}

// [ariaFor]: atributos de error accesibles | [Principio]: DRY | `as const` (TS): literal true para el tipo de aria-invalid
export function ariaFor(id: string, error?: string) {
  return error ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : {};
}

// [Field]: label + control + pista/error en un solo lugar | [Patrón]: Composite (molecule) | [Principio]: DRY
export function Field({ id, label, hint, error, required, children }: { id: string; label: string; hint?: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] font-semibold text-muted-foreground">
        {label}
        {required && <span className="req" aria-hidden="true"> *</span>} {/* aria-hidden: el asterisco es visual; `required` ya lo anuncia */}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[10px] text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-[11px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
