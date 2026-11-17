"use client"; // [Next.js]: Client Component → estado de carga, diálogo de confirmación y refresco
import { useState, useTransition, type ElementType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/components/layout/PreferencesProvider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmt } from "@aula/shared-i18n";
import { toast } from "@/components/shared/Toaster";
import { CloudOff, CloudUpload, Eye, Pencil, Trash2 } from "lucide-react"; // [2026-11-16]: modo `icons` (tarjetas del cuerpo)
// [RowActions]: botones CRUD de una fila de tabla de Gestión (ver · editar · publicar · eliminar) | [Patrón]: Presentational + Command (acciones inyectadas) + Confirm Dialog | [Principio]: DRY (cursos y recursos) + DIP (recibe Server Actions ya enlazadas) | [Paradigma]: Declarativo

// [Resultado de una acción]: mismo contrato que devuelven las Server Actions de fila
// `export` (2026-10-28): lo reutilizan acciones de cliente con fetch (p. ej. QuizActions) para entrar por el MISMO flujo toast + Dialog | [Principio]: DRY + SSOT del contrato
export type ActionResult = { ok: true; notice?: string } | { ok: false; message: string }; // `notice` (2026-10-27): el destino real fue otro (p. ej. «Enviada a revisión»)

export interface RowActionsProps {
  title: string; // Nombre del registro para el diálogo y los aria-label
  viewHref?: string;
  tryHref?: string; // [2026-10-30]: «Probar» = la actividad tal como la usa el estudiante | siempre <a>: suele ser una pantalla del remoto Angular (rewrite) → navegación completa
  editHref?: string; // [2026-10-23]: opcional → secciones sin edición (p. ej. juegos) solo muestran «Ver»
  // [Publicar]: opcional → solo entidades con estado publicado/borrador
  publish?: { isPublished: boolean; toggle: () => Promise<ActionResult>; blocked?: string }; // [2026-11-10]: `blocked` = motivo → «Publicar» deshabilitado (p. ej. curso sin examen final)
  onDelete?: (reason?: string) => Promise<ActionResult>; // `?` (TS): sin ella no se muestra "Eliminar" (p. ej. docente sin permiso)
  // [2026-11-11]: el borrado exige motivo (p. ej. revocar un certificado) → el diálogo pide el texto y lo pasa a onDelete
  deleteReason?: { label: string; min: number };
  deleteLabel?: string; // Texto del botón (p. ej. «Revocar», «Solicitar revocación»)
  deleteTitle: string; // Título del diálogo ("Eliminar curso")
  hard?: boolean; // [2026-10-23]: ver/editar son pantallas del remoto Angular (rewrites) → <a> con navegación completa en vez de <Link>
  // [confirm · 2026-10-24]: "inline" → la confirmación de borrado aparece EN la fila (sin ventana modal; Gestión → Actividades) · por defecto "dialog" (comportamiento anterior)
  confirm?: "dialog" | "inline";
  afterDeleteHref?: string; // [2026-10-27]: página de detalle → tras eliminar se vuelve a la lista (el registro ya no existe)
  publishLabel?: string; // [2026-10-27]: texto alternativo de «Publicar» (p. ej. «Enviar a revisión» para un docente en Música)
  icons?: boolean; // [2026-11-16]: botones solo con icono (ver · editar · publicar · eliminar) en las tarjetas del cuerpo; el nombre va en aria-label + title
}

export function RowActions({ title, viewHref, editHref, publish, onDelete, deleteTitle, hard = false, confirm = "dialog", afterDeleteHref, publishLabel, tryHref, deleteReason, deleteLabel, icons = false }: RowActionsProps) {
  const Nav: ElementType = hard ? "a" : Link; // `ElementType` (React): etiqueta o componente con la misma API (href, className)
  const { t } = usePreferences();
  const r = t.management.row;
  const router = useRouter();
  const [pending, startTransition] = useTransition(); // [React 19]: transición asíncrona → `pending` sin useState extra
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const reasonOk = !deleteReason || reason.trim().length >= deleteReason.min;

  // [run]: ejecuta la acción, muestra el error del backend o refresca la tabla | [Patrón]: Template Method
  // `done`: texto del aviso de éxito (toast) → el usuario confirma que el cambio se aplicó (2026-10-19)
  const afterDelete = () => setConfirmOpen(false); // Referencia estable → `run` sabe que fue un borrado
  const run = (action: () => Promise<ActionResult>, done: string, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      const res = await action();
      if (!res.ok) return setError(res.message);
      toast(res.notice ? "info" : "success", res.notice ?? done);
      after?.(); // `?.()` (ES2020): callback opcional
      if (after === afterDelete && afterDeleteHref) router.push(afterDeleteHref); // [2026-10-27]: borrado desde el detalle → a la lista
      router.refresh(); // Vuelve a pedir el RSC → la fila refleja el cambio
    });

  // [label]: con `icons` → icono (aria-hidden) y el texto solo para lectores de pantalla (sr-only) | sin él → texto visible como antes
  const label = (Icon: ElementType, text: string) => (icons ? <><Icon aria-hidden className="size-4" /><span className="sr-only">{text}</span></> : text);
  const sq = icons ? " size-8 px-0!" : ""; // Botón cuadrado en modo icono
  const publishText = publish ? (publish.isPublished ? r.unpublish : (publishLabel ?? r.publish)) : "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* [Botones uniformes · 2026-10-30]: Probar · Editar · Publicar · Eliminar en Exámenes, Cursos y Actividades (mismo orden en tablas y detalle) */}
      {tryHref && (
        // [2026-11-16]: «Probar» → «Ver» (la actividad/examen/curso tal como lo usa el estudiante)
        <a href={tryHref} className={`btn btn-outline btn-sm${sq}`} aria-label={`${r.view}: ${title}`} title={icons ? r.view : undefined}>
          {label(Eye, r.view)}
        </a>
      )}
      {viewHref && (
        <Nav href={viewHref} className={`btn btn-outline btn-sm${sq}`} aria-label={`${r.view}: ${title}`} title={icons ? r.view : undefined}>
          {label(Eye, r.view)}
        </Nav>
      )}
      {editHref && (
        <Nav href={editHref} className={`btn btn-outline btn-sm${sq}`} aria-label={`${r.edit}: ${title}`} title={icons ? r.edit : undefined}>
          {label(Pencil, r.edit)}
        </Nav>
      )}
      {publish && (
        <button
          type="button"
          onClick={() => run(publish.toggle, fmt(publish.isPublished ? r.unpublished : r.published, { title }))} // [2026-10-23]: aviso específico de publicar/despublicar
          disabled={pending || (!publish.isPublished && !!publish.blocked)}
          title={!publish.isPublished && publish.blocked ? publish.blocked : icons ? publishText : undefined}
          aria-label={icons ? `${publishText}: ${title}` : undefined}
          className={
            (publish.isPublished
              ? "btn btn-sm border border-tone-warning-line bg-card text-tone-warning hover:bg-tone-warning-soft"
              : "btn btn-sm border border-tone-brand-line bg-card text-tone-brand hover:bg-tone-brand-soft") + sq
          }
        >
          {pending && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />} {/* [Loader]: la acción está en curso */}
          {!(icons && pending) && label(publish.isPublished ? CloudOff : CloudUpload, publishText)}
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
          aria-label={icons ? `${deleteLabel ?? r.delete}: ${title}` : undefined}
          title={icons ? (deleteLabel ?? r.delete) : undefined}
          className={`btn btn-sm border border-tone-danger-line bg-card text-tone-danger hover:bg-tone-danger-soft${sq}`}
        >
          {label(Trash2, deleteLabel ?? r.delete)}
        </button>
      )}
      {error && !(confirmOpen && confirm === "dialog") && (
        <span role="alert" className="text-[10px] text-destructive">
          {error}
        </span>
      )}

      {/* [Confirmación en línea · 2026-10-24]: mismo texto y acciones que el diálogo, dentro de la fila | `autoFocus` lleva el foco a «Cancelar» (opción segura) | Esc cancela */}
      {onDelete && confirm === "inline" && confirmOpen && (
        <div role="group" aria-label={deleteTitle} onKeyDown={(e) => e.key === "Escape" && !pending && setConfirmOpen(false)} className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-tone-danger-line bg-tone-danger-soft p-2 text-xs text-tone-danger">
          <span className="min-w-0 flex-1">{fmt(r.deleteConfirm, { title })}</span>
          <button type="button" autoFocus onClick={() => setConfirmOpen(false)} disabled={pending} className="btn btn-outline btn-sm">
            {r.cancel}
          </button>
          <button type="button" onClick={() => run(onDelete, t.common.deleted, afterDelete)} disabled={pending} className="btn btn-danger btn-sm">
            {pending ? r.deleting : r.delete}
          </button>
        </div>
      )}

      {/* [Confirmación accesible]: Dialog (foco atrapado + Esc) en vez de window.confirm | [Patrón]: Controlled Dialog */}
      {onDelete && confirm === "dialog" && (
        <Dialog open={confirmOpen} onOpenChange={(o) => !pending && setConfirmOpen(o)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{deleteTitle}</DialogTitle>
              <DialogDescription>{fmt(r.deleteConfirm, { title })}</DialogDescription>
            </DialogHeader>
            {deleteReason && (
              <label className="block space-y-1 text-sm">
                {deleteReason.label}
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} required minLength={deleteReason.min} maxLength={500} rows={3} className="control w-full" />
              </label>
            )}
            {error && (
              <p role="alert" className="type-meta text-destructive">
                {error}
              </p>
            )}
            <DialogFooter className="gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={pending} className="btn btn-outline">
                {r.cancel}
              </button>
              <button type="button" onClick={() => run(() => onDelete(reason.trim() || undefined), t.common.deleted, afterDelete)} disabled={pending || !reasonOk} className="btn btn-danger">
                {pending ? r.deleting : (deleteLabel ?? r.delete)}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
