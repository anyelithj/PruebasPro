"use client";
import { useActionState, type ReactNode } from "react";
import type { CertFormResult } from "./actions";
// [CertActionForm · 2026-11-09 · RF-32]: formulario genérico de Gestión → Certificados (emitir, reemitir, notas, revocar, solicitar revocación)
// [Patrón]: Template (campos por children) + useActionState (React 19) | [A11y]: resultado en role=status/alert

export function CertActionForm({
  action,
  submitLabel,
  danger = false,
  confirm,
  children,
}: {
  action: (prev: CertFormResult, fd: FormData) => Promise<CertFormResult>;
  submitLabel: string;
  danger?: boolean;
  confirm?: string; // Pregunta antes de enviar (acciones irreversibles)
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className="space-y-3"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} aria-busy={pending} className={`btn btn-sm ${danger ? "btn-outline text-tone-danger" : "btn-primary"}`}>
          {pending ? "Enviando…" : submitLabel}
        </button>
        {state && (
          <p role={state.ok ? "status" : "alert"} className={`type-meta ${state.ok ? "text-tone-success" : "text-tone-danger"}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
