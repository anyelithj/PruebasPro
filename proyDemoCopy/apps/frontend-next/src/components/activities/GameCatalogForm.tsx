"use client"; // [Next.js]: Client Component → estado de envío y modal de resultado tras la Server Action
import { useState, useTransition } from "react";
import { updateGameAction } from "@/app/(portal)/admin/activities/actions";
import { ResultDialog, useResultDialog } from "@/components/shared/ResultDialog";
// [GameCatalogForm · 2026-10-28]: «Editar juego» del catálogo (título y descripción que ven los estudiantes en /juegos)
// Antes era un <form action> con `redirect` en el servidor → volvía a la tabla SIN ningún aviso; ahora muestra el MISMO modal de resultado que Recursos (Continuar → Juegos)
// [Patrón]: Controlled submit + Server Action + Custom Hook (useResultDialog) | [Principio]: DRY (mismo flujo que el resto de formularios de Gestión) + SRP | [A11y]: <label> visibles, error en role="alert", aria-busy

export interface GameCatalogFormProps {
  type: string; // Clave del juego en el catálogo (GAMES)
  title: string; // Valor guardado ("" = texto por defecto)
  description: string;
  defaultTitle: string; // Placeholder: texto por defecto del catálogo
  defaultDescription: string;
  backHref: string; // Pestaña Juegos de Gestión
}

export function GameCatalogForm({ type, title, description, defaultTitle, defaultDescription, backHref }: GameCatalogFormProps) {
  const { show, dialog } = useResultDialog();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition(); // `useTransition` (React 18+): la Server Action corre sin bloquear la UI

  // [onSubmit]: `FormData` (Web API) del propio <form> → misma firma que tenía la acción | `preventDefault`: el envío lo controla React
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      setError(null);
      const res = await updateGameAction(type, form);
      if (!res.ok) {
        show({ ok: false, message: `No se pudo guardar el juego: ${res.message}` }); // [Error]: modal + aviso en línea (como Recursos)
        return setError(res.message);
      }
      const name = String(form.get("title") ?? "").trim() || defaultTitle; // Vacío → nombre por defecto
      show({ ok: true, message: `«${name}» se actualizó con éxito.` }, backHref); // [Post/Redirect/Get]: Continuar → pestaña Juegos (ya revalidada)
    });
  };

  return (
    <form onSubmit={onSubmit} className="surface max-w-2xl space-y-4 p-5">
      <ResultDialog {...dialog} /> {/* [Modal de resultado]: controlado por useResultDialog */}
      <div>
        <label htmlFor="g-title" className="mb-1 block text-xs font-semibold text-muted-foreground">Título</label>
        <input id="g-title" name="title" maxLength={80} defaultValue={title} placeholder={defaultTitle} className="control w-full" />
      </div>
      <div>
        <label htmlFor="g-description" className="mb-1 block text-xs font-semibold text-muted-foreground">Descripción</label>
        <textarea id="g-description" name="description" maxLength={240} rows={3} defaultValue={description} placeholder={defaultDescription} className="control w-full" />
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-tone-danger-line bg-tone-danger-soft p-3 text-tone-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <a href={backHref} className="btn btn-ghost">Cancelar</a>
        <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
