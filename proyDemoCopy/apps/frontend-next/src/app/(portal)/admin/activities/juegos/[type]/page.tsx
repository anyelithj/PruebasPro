import type { Metadata } from "next"; // [Next.js]: Metadata API | `import type` (TS): se borra al compilar
import { notFound } from "next/navigation";
import { BackLink } from "@/components/shared/BackLink";
import { apiFetch } from "@/lib/api-client";
import { getCurrentAccessToken } from "@/lib/auth";
import { GAMES } from "@/lib/activities-api";
import { GameCatalogForm } from "@/components/activities/GameCatalogForm"; // [2026-10-28]: formulario de cliente con el MISMO modal de resultado que Recursos
// [Página /admin/activities/juegos/[type] · 2026-10-24]: «Editar juego» de Gestión → Actividades → Juegos — título y descripción que ven los estudiantes en /juegos
// [Patrón]: Container (RSC: carga con el token) + Presentational (GameCatalogForm, cliente) + Server Action | [Principio]: SRP + Progressive Enhancement | [A11y]: <label> visibles, contador nativo maxLength

export const metadata: Metadata = { title: "Editar juego", robots: { index: false, follow: false } }; // [SEO]: página privada

type CatalogGame = { type: string; title: string | null; description: string | null; status: string };

export default async function EditGamePage(props: { params: Promise<{ type: string }> }) {
  const { type } = await props.params; // [Next.js 16]: `params` es una Promise
  const def = GAMES[type];
  if (!def) notFound(); // [Fail Fast]: tipo desconocido → 404
  const { games } = await apiFetch<{ games: CatalogGame[] }>("/games/catalog", { bearer: (await getCurrentAccessToken()) ?? undefined });
  const current = games.find((g) => g.type === type);

  return (
    <div className="w-full space-y-5 py-4">
      <BackLink href="/admin/activities?tab=games" memo="activities">Volver a actividades</BackLink>
      <header>
        <h1 className="title-page">Editar juego</h1>
        <p className="mt-1 text-muted-foreground">
          {def.title} · deja un campo vacío para usar el texto por defecto. Publicar, despublicar o eliminar se hace desde la tabla.
        </p>
      </header>
      <GameCatalogForm type={type} title={current?.title ?? ""} description={current?.description ?? ""} defaultTitle={def.title} defaultDescription={def.description} backHref="/admin/activities?tab=games" />
    </div>
  );
}
