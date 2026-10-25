"use client"; // [Next.js]: Client Component → useActionState + toggle de visibilidad
import { useActionState } from "react"; // [React 19]: <form> ↔ Server Action con estado y pending
import { PasswordInput } from "@/components/ui/password-input"; // [Reutilización]: input con icono de ojo (ver/ocultar) | [Principio]: DRY
import { usePreferences } from "@/components/layout/PreferencesProvider";
import { changePasswordAction, type PasswordFormState } from "./actions";
import { Field, ariaFor } from "./ProfileEditForm"; // [Reutilización]: mismo label + pista/error que los datos personales
// [ChangePasswordForm · 2026-10-23]: tarjeta "Cambiar contraseña" (actual + nueva + repetir) | [Patrón]: Presentational + Command (Server Action) | [Principio]: SRP | [Seguridad]: autocomplete correcto para gestores de contraseñas

const INITIAL: PasswordFormState = { status: "idle" }; // Fuera del componente: referencia estable

export function ChangePasswordForm() {
  const { t } = usePreferences();
  const p = t.profile;
  const [state, formAction, pending] = useActionState(changePasswordAction, INITIAL);
  const errors = state.fieldErrors ?? {};

  return (
    <section aria-labelledby="password-title" className="w-full rounded-[14px] border border-border bg-card p-[18px] shadow-[var(--nl-shd)]">
      <h2 id="password-title" className="mb-3 text-sm font-bold">
        {p.passwordTitle}
      </h2>
      {/* `action` (React 19): tras cada envío React limpia el form → las contraseñas no quedan a la vista */}
      <form action={formAction} noValidate className="flex flex-col gap-[9px]">
        {state.message && (
          <div role={state.status === "error" ? "alert" : "status"} aria-live="polite" className={state.status === "error" ? "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive" : "rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary"}>
            {state.message}
          </div>
        )}
        {/* [2026-10-24]: a todo el ancho → actual, nueva y repetir en una fila desde md (en móvil se apilan) */}
        <div className="grid gap-[9px] md:grid-cols-3">
          <Field id="currentPassword" label={p.currentPassword} error={errors.currentPassword} required>
            <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" required {...ariaFor("currentPassword", errors.currentPassword)} />
          </Field>
          <Field id="newPassword" label={p.newPassword} hint={p.passwordRule} error={errors.newPassword} required>
            <PasswordInput id="newPassword" name="newPassword" autoComplete="new-password" minLength={8} maxLength={128} required aria-describedby="newPassword-hint" {...ariaFor("newPassword", errors.newPassword)} />
          </Field>
          <Field id="confirmPassword" label={p.confirmPassword} error={errors.confirmPassword} required>
            <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" maxLength={128} required {...ariaFor("confirmPassword", errors.confirmPassword)} />
          </Field>
        </div>
        <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-primary w-full md:ml-auto md:w-64">{/* [2026-10-24]: a la derecha en escritorio (la tarjeta ahora es ancha) */}
          {pending ? p.saving : p.changePassword}
        </button>
      </form>
    </section>
  );
}
