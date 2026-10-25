import { KindIcon } from "@/components/shared/KindIcon"; // [2026-10-23]: iconos SVG uniformes por tipo de recurso
import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: enlace «volver» uniforme (icono + texto)
import type { Metadata } from "next";
import { DownloadMenu } from "@/components/curriculum/DownloadMenu"; // [2026-10-23]: descargar el tema
import Link from "next/link";
import { listCurriculum } from "@/lib/curriculum-api";
import { getCurrentUserPayload } from "@/lib/auth";
import { Role } from "@/lib/constants";
import { languageLabel } from "@/lib/languages";
import { StatusBadge } from "@/components/curriculum/CurriculumBadges";
import { ResourcePreview } from "@/components/curriculum/ResourcePreview";
import { RowActions } from "@/components/admin/RowActions";
import { deleteResourceAction, deleteTopicAction, setResourcePublishedAction, setTopicPublishedAction } from "../actions";
import { groupQuery, KIND_META, KINDS, type CurriculumItem, type CurriculumItemKind } from "@/types/curriculum";
import { TopicTitle } from "@/components/language/TopicTitle"; // [2026-10-19]: tema en el idioma estudiado con IPA, audio y traducción
// [Página /admin/curriculum/tema]: un TEMA de Gestión (tema + idioma + nivel + tipo) con todos sus elementos desplegados; acciones del tema completo y de cada elemento
// [Patrón]: Container (RSC) + Composite Command (acciones del grupo) | [Principio]: SRP + DRY (RowActions y ResourcePreview reutilizados) | [Paradigma]: Declarativo

export const metadata: Metadata = { title: "Gestión · Tema", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic"; // Datos por usuario/rol

interface SearchParams {
  topic?: string;
  language?: string;
  level?: string;
  kind?: string;
}

// [headline]: texto principal de un elemento para la lista | `find` + type guard (TS)
const headline = (c: Record<string, unknown>) => [c.lemma, c.text, c.title, c.source, c.incorrect, c.prompt].find((v): v is string => typeof v === "string") ?? "—";

export default async function AdminTopicPage(props: { searchParams: Promise<SearchParams> }) {
  const [sp, user] = await Promise.all([props.searchParams, getCurrentUserPayload()]);
  const isAdmin = user?.role === Role.ADMIN;
  const kind = KINDS.includes(sp.kind as CurriculumItemKind) ? (sp.kind as CurriculumItemKind) : undefined;
  const ref = { topic: sp.topic ?? "", language: sp.language ?? "", level: sp.level ?? "", kind: kind ?? "vocabulary" };

  let items: CurriculumItem[] = [];
  let loadError: string | null = null;
  try {
    items = sp.topic ? (await listCurriculum({ topic: sp.topic, language: sp.language, level: sp.level, kind, limit: 100 })).data : [];
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }
  const approved = items.filter((i) => i.reviewStatus === "approved").length;
  const allPublished = items.length > 0 && approved === items.length;
  const q = groupQuery(ref);

  return (
    <div className="w-full space-y-5 py-4">
      <BackLink href="/admin/curriculum" memo="content">Volver a recursos</BackLink>

      <header className="surface flex flex-wrap items-center gap-4 p-5">
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-tone-brand-soft text-tone-brand">
          <KindIcon kind={kind} className="size-8" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{sp.topic}</h1>
          {sp.topic && sp.language && <TopicTitle topic={sp.topic} language={sp.language} className="mt-1" />}
          <p className="mt-1 text-sm text-muted-foreground">
            {kind ? KIND_META[kind].label : "—"} · {sp.language ? languageLabel(sp.language) : "—"} · {sp.level} · <b>{items.length}</b> elementos · {approved} publicados
          </p>
        </div>
        {/* [Acciones del tema]: un solo "Editar" (abre el tema completo y permite añadir elementos), publicar todos y eliminar todos */}
        <div className="flex flex-wrap items-center gap-2">
          {/* [Descargar · 2026-10-23]: todo el tema en PDF, Word, Excel o CSV */}
          {items.length > 0 && <DownloadMenu filters={{ topic: sp.topic, language: sp.language, level: sp.level, kind }} />}
          <RowActions
            title={`${sp.topic} (${items.length})`}
            editHref={`/admin/curriculum/tema/editar?${q}`}
            publish={items.length && (isAdmin || approved > 0) ? { isPublished: allPublished, toggle: setTopicPublishedAction.bind(null, ref, !allPublished) } : undefined}
            onDelete={isAdmin && items.length ? deleteTopicAction.bind(null, ref) : undefined}
            deleteTitle={`Eliminar el tema y sus ${items.length} elementos`}
          />
        </div>
      </header>

      {loadError && (
        <p role="alert" className="rounded-lg border border-tone-danger-line bg-tone-danger-soft p-4 text-sm text-tone-danger">
          No se pudieron cargar los elementos: {loadError}
        </p>
      )}

      {/* [Elementos desplegados]: tarjeta por elemento con vista previa (audio incluido) y acciones individuales */}
      <ul className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {items.map((it) => (
          <li key={it.id} className="surface flex flex-col overflow-hidden">
            <header className="flex items-center justify-between gap-2 border-b border-border bg-muted px-4 py-2">
              <Link href={`/admin/curriculum/${it.id}`} className="truncate text-sm font-semibold text-primary hover:underline">
                {headline(it.content)}
              </Link>
              <StatusBadge status={it.reviewStatus} />
            </header>
            <div className="flex-1 p-4" lang={it.language}>
              <ResourcePreview kind={it.kind} content={it.content} language={it.language} />
            </div>
            <footer className="border-t border-border px-3 py-2">
              <RowActions
                title={headline(it.content)}
                viewHref={`/admin/curriculum/${it.id}`}
                editHref={`/admin/curriculum/${it.id}#edit-title`}
                publish={isAdmin || it.reviewStatus === "approved" ? { isPublished: it.reviewStatus === "approved", toggle: setResourcePublishedAction.bind(null, it.id, it.reviewStatus !== "approved") } : undefined}
                onDelete={isAdmin ? deleteResourceAction.bind(null, it.id) : undefined}
                deleteTitle="Eliminar elemento"
              />
            </footer>
          </li>
        ))}
      </ul>
    </div>
  );
}
