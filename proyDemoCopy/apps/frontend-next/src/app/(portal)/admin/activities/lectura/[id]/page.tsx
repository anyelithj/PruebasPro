import type { Metadata } from "next"; // [Next.js]: Metadata API | `import type` (TS): se borra al compilar
import { notFound } from "next/navigation";
import { BackLink } from "@/components/shared/BackLink";
import { ReadingEditor } from "@/components/reading/ReadingEditor";
import { apiFetch } from "@/lib/api-client";
import { getCurrentAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import type { ReadingTextDetail } from "@/lib/reading";
// [Página /admin/activities/lectura/[id] · Lectura · 2026-10-25]: editor de una lectura en Gestión → Actividades — metadatos, texto completo, frase a frase (texto, traducción, IPA), completar IPA/traducción y publicar
// [Patrón]: Container (RSC: carga con el token en el servidor) + Presentational (ReadingEditor, cliente) + Server Actions | [Principio]: SRP + mínimo privilegio (NestJS decide si es editable) | [SEO]: página privada (noindex)

export const metadata: Metadata = { title: "Editar lectura", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic"; // Siempre el estado actual (traducciones que se completan, estado de publicación)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditReadingPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ volver?: string }> }) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]); // [Next.js 16]: `params` y `searchParams` son Promises
  if (!UUID.test(id)) notFound(); // [Fail Fast]: id con formato inválido → 404 sin llamar a NestJS
  let text: ReadingTextDetail;
  try {
    text = await apiFetch<ReadingTextDetail>(`/reading/texts/${encodeURIComponent(id)}`, { bearer: (await getCurrentAccessToken()) ?? undefined });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) notFound();
    throw err; // Otros errores → error.tsx del portal
  }
  if (!text.editable) notFound(); // Un estudiante que conoce el enlace no ve el editor
  // [volver]: solo rutas internas de Gestión (evita redirecciones abiertas)
  const back = sp.volver?.startsWith("/admin/activities") ? sp.volver : "/admin/activities?tab=reading";

  return (
    <div className="w-full space-y-5 py-4">
      <BackLink href={back} memo="activities">
        Volver a actividades
      </BackLink>
      <ReadingEditor text={text} />
    </div>
  );
}
