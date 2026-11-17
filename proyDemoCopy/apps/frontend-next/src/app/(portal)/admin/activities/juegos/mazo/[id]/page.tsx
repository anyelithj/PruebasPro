import type { Metadata } from "next"; // [Next.js]: Metadata API | `import type` (TS): se borra al compilar
import { notFound } from "next/navigation";
import { BackLink } from "@/components/shared/BackLink";
import { DeckEditForm, type DeckEditable } from "@/components/activities/DeckEditForm";
import { apiFetch } from "@/lib/api-client";
import { getCurrentAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { languageLabel } from "@/lib/languages";
// [Página /admin/activities/juegos/mazo/[id] · 2026-10-27]: «Editar» de un juego con material propio (Gestión → Actividades → Juegos) — título, juego, nivel y palabras
// Ruta estática «mazo» → no choca con /juegos/[type] (editar el texto de un juego del catálogo) | [Patrón]: Container (RSC: carga con el token en el servidor) + Presentational (DeckEditForm, cliente) + Server Action
// [Principio]: SRP + mínimo privilegio (NestJS exige autor o ADMIN al guardar) | [SEO]: página privada (noindex)

export const metadata: Metadata = { title: "Editar juego", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic"; // Siempre las palabras actuales

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditDeckPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ volver?: string }> }) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]); // [Next.js 16]: `params` y `searchParams` son Promises
  if (!UUID.test(id)) notFound(); // [Fail Fast]: id con formato inválido → 404 sin llamar a NestJS
  let deck: DeckEditable;
  try {
    deck = await apiFetch<DeckEditable>(`/games/decks/${encodeURIComponent(id)}`, { bearer: (await getCurrentAccessToken()) ?? undefined });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) notFound();
    throw err; // Otros errores → error.tsx del portal
  }
  // [volver]: solo rutas internas de Gestión (evita redirecciones abiertas)
  const back = sp.volver?.startsWith("/admin/activities") ? sp.volver : "/admin/activities?tab=games";

  return (
    <div className="w-full space-y-5 py-4">
      <BackLink href={back} memo="activities">
        Volver a actividades
      </BackLink>
      <header>
        <h1 className="title-page">Editar juego</h1>
        <p className="mt-1 text-muted-foreground">Cambia el título, el juego, el nivel o las palabras. Publicar, despublicar o eliminar se hace desde la tabla.</p>
      </header>
      <DeckEditForm deck={deck} languageName={languageLabel(deck.language)} backHref={back} />
    </div>
  );
}
