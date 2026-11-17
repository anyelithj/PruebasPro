"use client"; // [Next.js]: Client Component → useActionState (React 19)
import { useActionState } from "react"; // [React 19]: <form> ↔ Server Action con estado y pending
import { PasswordInput } from "@/components/ui/password-input"; // [Reutilización]: input con ojo ver/ocultar | [Principio]: DRY
import { usePreferences } from "@/components/layout/PreferencesProvider"; // [i18n]: textos del idioma activo
import { toggleTwoFactorAction, type TwoFactorFormState } from "./actions";
import { Field } from "./ProfileEditForm"; // [Reutilización]: mismo label + error que el resto del perfil
// [TwoFactorCard · 2026-11-16]: tarjeta «Verificación en dos pasos» (código OTP al correo) | [Patrón]: Presentational + Command (Server Action) | [Principio]: SRP | [Accesibilidad]: estado con texto (no solo color), role="status"/"alert", label asociado

export function TwoFactorCard({ initialEnabled }: { initialEnabled: boolean }) {
  const { t } = usePreferences();
  const p = t.profile;
  // `useActionState` (React 19): [estado, acción para <form action>, pending]
  const [state, formAction, pending] = useActionState<TwoFactorFormState, FormData>(toggleTwoFactorAction, { status: "idle" });
  const enabled = state.enabled ?? initialEnabled; // `??` (ES2020): hasta la primera acción manda el valor del servidor

  return (
    <section aria-labelledby="twofactor-title" className="w-full surface p-[18px]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="twofactor-title" className="title-section">{p.twoFactorTitle}</h2>
        {/* [Estado]: texto + color → legible sin depender del color (WCAG 1.4.1) */}
        <span className={enabled ? "rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary" : "rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground"}>
          {enabled ? p.twoFactorOn : p.twoFactorOff}
        </span>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">{p.twoFactorIntro}</p>
      <form action={formAction} noValidate className="flex flex-col gap-[9px] md:flex-row md:items-end">
        {/* [Campo oculto]: estado deseado = contrario al actual */}
        <input type="hidden" name="enabled" value={String(!enabled)} />
        <div className="md:flex-1">
          <Field id="twofactor-password" label={p.twoFactorPassword} required>
            <PasswordInput id="twofactor-password" name="password" autoComplete="current-password" required />
          </Field>
        </div>
        <button type="submit" disabled={pending} aria-busy={pending} className={enabled ? "btn btn-outline w-full md:w-64" : "btn btn-primary w-full md:w-64"}>
          {pending ? p.saving : enabled ? p.twoFactorDisable : p.twoFactorEnable}
        </button>
      </form>
      {state.message && (
        <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className={state.status === "error" ? "mt-2 text-xs text-destructive" : "mt-2 text-xs text-primary"}>
          {state.message}
        </p>
      )}
    </section>
  );
}
