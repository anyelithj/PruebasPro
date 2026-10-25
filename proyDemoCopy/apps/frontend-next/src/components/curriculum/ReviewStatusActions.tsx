"use client"; // [Next.js]: Client Component → botones con estado y petición al BFF
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { STATUS_HELP, STATUS_LABEL, STATUS_TRANSITIONS, transitionAction, type ReviewStatus } from "@/types/curriculum";
// [ReviewStatusActions]: "Estado de publicación" — muestra el flujo (Borrador → En revisión → Revisado → Publicado), explica el estado actual y ofrece solo las acciones válidas con verbos claros
// [Patrón]: State Machine (espejo de la del backend) + Two-step action (acciones que exigen comentario piden confirmarlo) | [Principio]: SRP | [Paradigma]: Funcional + Reactivo
// [Nota]: la UI solo sugiere; el backend es la autoridad (valida transición y rol ADMIN para publicar/devolver)

const FLOW: ReadonlyArray<ReviewStatus> = ["draft", "review_required", "reviewed", "approved"]; // Camino feliz mostrado como pasos

export function ReviewStatusActions({ id, status, version }: { id: string; status: ReviewStatus; version: number }) {
  const router = useRouter();
  const [pending, setPending] = useState<ReviewStatus | null>(null); // Acción que espera comentario (paso 2 de 2)
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // [send]: POST /api/curriculum/:id/status | `async/await` con error visible
  const send = async (to: ReviewStatus) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/curriculum/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to, expectedVersion: version, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        setError(body.message ?? `HTTP ${res.status}`);
        return;
      }
      setNote("");
      setPending(null);
      router.refresh(); // Recarga el Server Component (nuevo estado y versión)
    } finally {
      setBusy(false);
    }
  };

  // [onAction]: si la acción admite/exige comentario → abre el cuadro; si no, ejecuta directo
  const onAction = (to: ReviewStatus) => (transitionAction(status, to).note ? setPending(to) : void send(to));
  const pendingAction = pending ? transitionAction(status, pending) : null; // La acción depende del origen (devolver ≠ volver a borrador)
  const stepIndex = FLOW.indexOf(status); // -1 si está devuelto/archivado (fuera del camino feliz)

  return (
    <div className="space-y-4">
      {/* [Pasos del flujo]: <ol> semántico + aria-current="step" en el actual */}
      <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="Flujo de publicación">
        {FLOW.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              aria-current={s === status ? "step" : undefined}
              className={cn(
                "badge",
                s === status ? "bg-gradient-brand text-white" : stepIndex > i ? "bg-tone-brand-soft text-tone-brand" : "bg-muted text-muted-foreground",
              )}
            >
              {stepIndex > i ? "✓ " : ""}
              {STATUS_LABEL[s]}
            </span>
            {i < FLOW.length - 1 && <span aria-hidden className="text-muted-foreground">→</span>}
          </li>
        ))}
        {stepIndex === -1 && <li className="badge bg-tone-warning-soft text-tone-warning">Ahora: {STATUS_LABEL[status]}</li>}
      </ol>
      <p className="text-sm text-muted-foreground">{STATUS_HELP[status]}</p>

      {/* [Acciones válidas desde el estado actual] */}
      {!pending && (
        <div className="flex flex-wrap gap-2">
          {STATUS_TRANSITIONS[status].map((to) => {
            const a = transitionAction(status, to);
            return (
              <button key={to} type="button" disabled={busy} onClick={() => onAction(to)} className={cn("btn btn-sm", a.tone === "primary" ? "btn-primary" : a.tone === "danger" ? "border border-tone-danger-line bg-card text-tone-danger hover:bg-tone-danger-soft" : "btn-outline")}>
                {a.label}
              </button>
            );
          })}
        </div>
      )}

      {/* [Paso 2]: comentario para el autor (obligatorio al devolver, opcional al publicar) */}
      {pending && pendingAction && (
        <div className="space-y-2 rounded-lg border border-border bg-muted p-3">
          <label htmlFor="review-note" className="block text-xs font-semibold">
            {pendingAction.note === "required" ? "¿Qué debe corregir el autor? *" : "Comentario para el autor (opcional)"}
          </label>
          <textarea
            id="review-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={pendingAction.note === "required" ? "Ej.: falta la variante regional de la IPA." : "Ej.: ¡Buen trabajo!"}
            className="control w-full"
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || (pendingAction.note === "required" && !note.trim())}
              onClick={() => void send(pending)}
              className={cn("btn btn-sm", pendingAction.tone === "danger" ? "btn-danger" : "btn-primary")}
            >
              {pendingAction.label}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPending(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-tone-danger">
          {error}
        </p>
      )}
    </div>
  );
}
