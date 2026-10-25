"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
// [QuizActions]: botones acciones quiz para docente/admin | [Patrón]: Presentational | [Principio]: SRP

export interface QuizActionsProps {
  quizId: string;
  title: string;
  isPublished: boolean;
}

export function QuizActions({ quizId, title, isPublished }: QuizActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // [Modal de confirmación]: reemplaza window.confirm por Dialog accesible | [Patrón]: Controlled Dialog
  const [confirmOpen, setConfirmOpen] = useState(false);

  const togglePublish = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quiz/${quizId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !isPublished }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  // [Eliminación confirmada]: ejecutada desde el Dialog, no desde window.confirm | [Patrón]: Command
  const onDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quiz/${quizId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      setConfirmOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/quiz/${quizId}`}
        className="btn btn-outline btn-sm"
      >
        Ver detalle
      </Link>
      <Link
        href={`/quiz/${quizId}/edit`}
        className="btn btn-outline btn-sm"
      >
        Editar
      </Link>
      <button
        type="button"
        onClick={togglePublish}
        disabled={busy}
        className={
          isPublished
            ? "btn btn-sm border border-tone-warning-line bg-card text-tone-warning hover:bg-tone-warning-soft"
            : "btn btn-sm border border-tone-brand-line bg-card text-tone-brand hover:bg-tone-brand-soft"
        }
      >
        {busy ? "..." : isPublished ? "Despublicar" : "Publicar"}
      </button>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirmOpen(true);
        }}
        disabled={busy}
        className="btn btn-sm border border-tone-danger-line bg-card text-tone-danger hover:bg-tone-danger-soft"
      >
        Eliminar
      </button>
      {error && <span className="text-[10px] text-destructive">{error}</span>}

      {/* [Modal confirmación eliminar]: reemplaza la alerta nativa del navegador | [Patrón]: Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !busy && setConfirmOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar examen</DialogTitle>
            <DialogDescription>
              ¿Seguro que quieres eliminar el examen <b>“{title}”</b>? Esta acción no se
              puede deshacer.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={busy}
              className="btn btn-outline"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="btn btn-danger"
            >
              {busy ? "Eliminando..." : "Eliminar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
