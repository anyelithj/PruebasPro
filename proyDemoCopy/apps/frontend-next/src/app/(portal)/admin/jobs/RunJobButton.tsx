"use client"; // [Next.js]: Client Component → useActionState muestra el resultado de la Server Action

import { useActionState } from "react";
import { runJobAction, type RunJobState } from "./actions";
// [RunJobButton · Sprint 7.18]: «Ejecutar ahora» de un trabajo programado | [Patrón]: Presentational + Server Action (React 19 useActionState) | [Principio]: SRP | [A11y]: resultado en role="status" y botón deshabilitado mientras se envía

export function RunJobButton({ name }: { name: string }) {
  // `useActionState` (React 19): [estado, acción para <form>, pendiente]
  const [state, action, pending] = useActionState<RunJobState, FormData>(runJobAction, null);
  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="name" value={name} />
      <button type="submit" disabled={pending} className="btn btn-outline btn-sm" aria-label={`Ejecutar ahora ${name}`}>
        {pending ? "Encolando…" : "Ejecutar ahora"}
      </button>
      {state && (
        <p role="status" className={`max-w-56 text-right text-xs ${state.ok ? "text-tone-brand" : "text-destructive"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
