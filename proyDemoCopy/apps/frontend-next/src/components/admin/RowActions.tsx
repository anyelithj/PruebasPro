"use client"; // [Next.js]: Client Component → estado de carga, diálogo de confirmación y refresco
import { useState, useTransition, type ElementType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/components/layout/PreferencesProvider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmt } from "@aula/shared-i18n";
import { toast } from "@/components/shared/Toaster";
// [RowActions]: botones CRUD de una fila de tabla de Gestión (ver · editar · publicar · eliminar) | [Patrón]: Presentational + Command (acciones inyectadas) + Confirm Dialog | [Principio]: DRY (cursos y recursos) + DIP (recibe Server Actions ya enlazadas) | [Paradigma]: Declarativo

// [Resultado de una acción]: mismo contrato que devuelven las Server Actions de fila
type ActionResult = { ok: true } | { ok: false; message: string };

export interface RowActionsProps {
  title: string; // Nombre del registro para el diálogo y los aria-label
  viewHref?: string;
  editHref?: string; // [2026-10-23]: opcional → secciones sin edición (p. ej. juegos) solo muestran «Ver»
  // [Publicar]: opcional → solo entidades con estado publicado/borrador
  publish?: { isPublished: boolean; toggle: () => Promise<ActionResult> };
  onDelete?: () => Promise<ActionResult>; // `?` (TS): sin ella no se muestra "Eliminar" (p. ej. docente sin permiso)
  deleteTitle: string; // Título del diálogo ("Eliminar curso")
  hard?: boolean; // [2026-10-23]: ver/editar son pantallas del remoto Angular (rewrites) → <a> con navegación completa en vez de <Link>
}

export function RowActions({ title, viewHref, editHref, publish, onDelete, deleteTitle, hard = false }: RowActionsProps) {
  const Nav: ElementType = hard ? "a" : Link; // `ElementType` (React): etiqueta o componente con la misma API (href, className)
  const { t } = usePreferences();
  const r = t.management.row;
  const router = useRouter();
  const [pending, startTransition] = useTransition(); // [React 19]: transición asíncrona → `pending` sin useState extra
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // [run]: ejecuta la acción, muestra el error del backend o refresca la tabla | [Patrón]: Template Method
  // `done`: texto del aviso de éxito (toast) → el usuario confirma que el cambio se aplicó (2026-10-19)
  const run = (action: () => Promise<ActionResult>, done: string, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      const res = await action();
      if (!res.ok) return setError(res.message);
      toast("success", done);
      after?.(); // `?.()` (ES2020): callback opcional
      router.refresh(); // Vuelve a pedir el RSC → la fila refleja el cambio
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {viewHref && (
        <Nav href={viewHref} className="btn btn-outline btn-sm" aria-label={`${r.view}: ${title}`}>
          {r.view}
        </Nav>
      )}
      {editHref && (
        <Nav href={editHref} className="btn btn-outline btn-sm" aria-label={`${r.edit}: ${title}`}>
          {r.edit}
        </Nav>
      )}
      {publish && (
        <button
          type="button"
          onClick={() => run(publish.toggle, fmt(publish.isPublished ? r.unpublished : r.published, { title }))} // [2026-10-23]: aviso específico de publicar/despublicar
          disabled={pending}
          className={
            publish.isPublished
              ? "btn btn-sm border border-tone-warning-line bg-card text-tone-warning hover:bg-tone-warning-soft"
              : "btn btn-sm border border-tone-brand-line bg-card text-tone-brand hover:bg-tone-brand-soft"
          }
        >
          {pending && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />} {/* [Loader]: la acción está en curso */}
          {publish.isPublished ? r.unpublish : r.publish}
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setConfirmOpen(true);
          }}
          disabled={pending}
          className="btn btn-sm border border-tone-danger-line bg-card text-tone-danger hover:bg-tone-danger-soft"
        >
          {r.delete}
        </button>
      )}
      {error && !confirmOpen && (
        <span role="alert" className="text-[10px] text-destructive">
          {error}
        </span>
      )}

      {/* [Confirmación accesible]: Dialog (foco atrapado + Esc) en vez de window.confirm | [Patrón]: Controlled Dialog */}
      {onDelete && (
        <Dialog open={confirmOpen} onOpenChange={(o) => !pending && setConfirmOpen(o)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{deleteTitle}</DialogTitle>
              <DialogDescription>{fmt(r.deleteConfirm, { title })}</DialogDescription>
            </DialogHeader>
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <DialogFooter className="gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={pending} className="btn btn-outline">
                {r.cancel}
              </button>
              <button type="button" onClick={() => run(onDelete, t.common.deleted, () => setConfirmOpen(false))} disabled={pending} className="btn btn-danger">
                {pending ? r.deleting : r.delete}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
