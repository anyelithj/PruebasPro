"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/shared/Toaster";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
// [DeactivateUserButton]: toggle activate/deactivate usuario | [Patrón]: Presentational | [Principio]: SRP

export interface DeactivateUserButtonProps {
  userId: string;
  userName: string;
  isActive: boolean;
}

export function DeactivateUserButton({ userId, userName, isActive }: DeactivateUserButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // [Modal de confirmación]: reemplaza window.confirm por Dialog accesible | [Patrón]: Controlled Dialog
  const [confirmOpen, setConfirmOpen] = useState(false);

  const action = isActive ? "desactivar" : "habilitar";
  const actionLabel = `${action.charAt(0).toUpperCase()}${action.slice(1)}`;

  // [Acción confirmada]: ejecutada desde el Dialog | [Patrón]: Command
  const onConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = isActive
        ? `/api/admin/users/${userId}`
        : `/api/admin/users/${userId}/activate`;
      const method = isActive ? "DELETE" : "POST";
      const res = await fetch(url, {
        method,
        headers: isActive ? undefined : { "Content-Type": "application/json" },
        body: isActive ? undefined : "{}",
      });
      if (!res.ok && res.status !== 204) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      setConfirmOpen(false);
      toast("success", isActive ? `Usuario «${userName}» desactivado.` : `Usuario «${userName}» habilitado.`); // [2026-10-19]
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirmOpen(true);
        }}
        disabled={busy}
        className={
          isActive
            ? "btn btn-sm border border-tone-danger-line bg-card text-tone-danger hover:bg-tone-danger-soft"
            : "btn btn-sm border border-tone-brand-line bg-card text-tone-brand hover:bg-tone-brand-soft"
        }
      >
        {isActive ? "Desactivar" : "Habilitar"}
      </button>
      {error && <span className="text-[10px] text-destructive">{error}</span>}

      {/* [Modal confirmación]: reemplaza la alerta nativa del navegador | [Patrón]: Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !busy && setConfirmOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{actionLabel} usuario</DialogTitle>
            <DialogDescription>
              ¿Seguro que quieres {action} a <b>{userName}</b>?
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
              onClick={onConfirm}
              disabled={busy}
              className={
                isActive
                  ? "btn btn-danger"
                  : "btn btn-primary"
              }
            >
              {busy ? "Procesando..." : actionLabel}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
