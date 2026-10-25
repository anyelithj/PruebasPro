import type { Metadata } from "next"; // [Next.js]: Metadata API | `import type` (TS): se borra al compilar
import { notFound } from "next/navigation";
import { BackLink } from "@/components/shared/BackLink";
import { apiFetch } from "@/lib/api-client";
import { getCurrentAccessToken } from "@/lib/auth";
import { GAMES } from "@/lib/activities-api";
import { updateGameAction } from "../../actions";
// [Página /admin/activities/juegos/[type] · 2026-10-24]: «Editar juego» de Gestión → Actividades → Juegos — título y descripción que ven los estudiantes en /juegos
// [Patrón]: Container (RSC) + Server Action (sin JS en el cliente: <form action>) + Post/Redirect/Get | [Principio]: SRP + Progressive Enhancement | [A11y]: <label> visibles, contador nativo maxLength

export const metadata: Metadata = { title: "Editar juego", robots: { index: false, follow: false } }; // [SEO]: página privada

type CatalogGame = { type: string; title: string | null; description: string | null; status: string };

export default async function EditGamePage(props: { params: Promise<{ type: string }> }) {
  const { type } = await props.params; // [Next.js 16]: `params` es una Promise
  const def = GAMES[type];
  if (!def) notFound(); // [Fail Fast]: tipo desconocido → 404
  const { games } = await apiFetch<{ games: CatalogGame[] }>("/games/catalog", { bearer: (await getCurrentAccessToken()) ?? undefined });
  const current = games.find((g) => g.type === type);
  const save = updateGameAction.bind(null, type); // `bind` (ES5): fija el tipo → la acción recibe solo el FormData

  return (
    <div className="w-full space-y-5 py-4">
      <BackLink href="/admin/activities?tab=games" memo="activities">Volver a actividades</BackLink>
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Editar juego</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {def.title} · deja un campo vacío para usar el texto por defecto. Publicar, despublicar o eliminar se hace desde la tabla.
        </p>
      </header>
      <form action={save} className="surface max-w-2xl space-y-4 p-5">
        <div>
          <label htmlFor="g-title" className="mb-1 block text-xs font-semibold text-muted-foreground">Título</label>
          <input id="g-title" name="title" maxLength={80} defaultValue={current?.title ?? ""} placeholder={def.title} className="control w-full" />
        </div>
        <div>
          <label htmlFor="g-description" className="mb-1 block text-xs font-semibold text-muted-foreground">Descripción</label>
          <textarea id="g-description" name="description" maxLength={240} rows={3} defaultValue={current?.description ?? ""} placeholder={def.description} className="control w-full" />
        </div>
        <div className="flex justify-end gap-2">
          <a href="/admin/activities?tab=games" className="btn btn-ghost">Cancelar</a>
          <button type="submit" className="btn btn-primary">Guardar cambios</button>
        </div>
      </form>
    </div>
  );
}
