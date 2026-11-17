import { KindIcon } from "@/components/shared/KindIcon"; // [2026-10-23]: iconos SVG uniformes por tipo de recurso
import { ResourceBackLink } from "@/components/curriculum/ResourceBackLink"; // [2026-10-24]: «Volver a vocabulario / pronunciación…» según el tipo
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
import { DetailCard, DetailGrid, DetailHeader } from "@/components/shared/DetailHeader"; // [2026-10-28]: cabecera y tarjetas extraídas → el detalle de Exámenes y Actividades usa el MISMO diseño
import { deleteResourceAction, deleteTopicAction, setResourcePublishedAction, setTopicPublishedAction } from "../actions";
import { groupQuery, KIND_META, KINDS, type CurriculumItem, type CurriculumItemKind } from "@/types/curriculum";
import { TopicTitle } from "@/components/language/TopicTitle"; // [2026-10-19]: tema en el idioma estudiado con IPA, audio y traducción
import { findInChart, PhonemeSheet } from "@/components/curriculum/PhonemeSheet"; // [2026-11-14]: tema de pronunciación = MISMA ficha que /resources/fonema
import { findPhoneme } from "@/config/ipa-chart";
import { isLanguage } from "@/lib/languages";
import type { Language } from "@/types/quiz";
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

  // [Acciones del tema]: un solo "Editar" (abre el tema completo y permite añadir elementos), publicar todos, eliminar todos y descargar
  const topicActions = (
    <>
      {/* [Descargar · 2026-10-23]: todo el tema en PDF, Word, Excel o CSV */}
      {items.length > 0 && <DownloadMenu filters={{ topic: sp.topic, language: sp.language, level: sp.level, kind }} />}
      <RowActions
        title={`${sp.topic} (${items.length})`}
        editHref={`/admin/curriculum/tema/editar?${q}`}
        publish={items.length && (isAdmin || approved > 0) ? { isPublished: allPublished, toggle: setTopicPublishedAction.bind(null, ref, !allPublished) } : undefined}
        onDelete={isAdmin && items.length ? deleteTopicAction.bind(null, ref) : undefined}
        deleteTitle={`Eliminar el tema y sus ${items.length} elementos`}
      />
    </>
  );
  const errorBox = loadError && (
    <p role="alert" className="rounded-lg border border-tone-danger-line bg-tone-danger-soft p-4 text-tone-danger">
      No se pudieron cargar los elementos: {loadError}
    </p>
  );
  // [Elementos desplegados]: tarjeta por elemento con vista previa (audio incluido), estado y acciones individuales
  // [2026-11-16 · Fichas de pronunciación]: lista a todo el ancho y ficha compacta (antes columnas masonry con huecos y el título repetido)
  const renderItems = (compact: boolean) => (
    <DetailGrid masonry={!compact} minWidth={compact ? 9999 : 260}>
      {items.map((it) => (
        <DetailCard
          key={it.id}
          lang={it.language}
          title={
            <Link href={`/admin/curriculum/${it.id}`} className="text-primary hover:underline">
              {headline(it.content)}
            </Link>
          }
          badge={<StatusBadge status={it.reviewStatus} />}
          footer={
            <RowActions
              icons // [2026-11-16]: en el cuerpo, ver · editar · publicar · eliminar como iconos (el texto queda en aria-label y title)
              title={headline(it.content)}
              viewHref={`/admin/curriculum/${it.id}`}
              editHref={`/admin/curriculum/${it.id}#edit-title`}
              publish={isAdmin || it.reviewStatus === "approved" ? { isPublished: it.reviewStatus === "approved", toggle: setResourcePublishedAction.bind(null, it.id, it.reviewStatus !== "approved") } : undefined}
              onDelete={isAdmin ? deleteResourceAction.bind(null, it.id) : undefined}
              deleteTitle="Eliminar elemento"
            />
          }
        >
          <ResourcePreview kind={it.kind} content={it.content} language={it.language} compact={compact} />
        </DetailCard>
      ))}
    </DetailGrid>
  );
  const itemGrid = renderItems(false);

  // [2026-11-14 · Pronunciación]: si el tema es un fonema («/ɒ/ · hot») se muestra IGUAL que /resources/fonema (antes: otra interfaz)
  // y las fichas del docente van en «Fichas del tema» con su estado y acciones | `&&` encadenado: cualquier dato faltante → diseño general
  const language = isLanguage(sp.language) ? (sp.language as Language) : null;
  const phoneme = kind === "pronunciation" && language && sp.topic ? findPhoneme(language, sp.topic) : null;
  const chart = phoneme && language ? findInChart(language, phoneme.symbol) : null;
  if (chart && language) {
    return (
      <div className="fade-in w-full space-y-5 py-4">
        <ResourceBackLink kind={kind} href="/admin/curriculum?kind=pronunciation" memo="content" />
        {errorBox}
        {/* [2026-11-16]: MISMA cabecera que los demás temas de Gestión (DetailHeader) · la ficha del fonema va debajo sin su cabecera propia */}
        <DetailHeader
          icon={<KindIcon kind={kind} className="size-8" />}
          title={sp.topic}
          meta={
            <>
              {KIND_META.pronunciation.label} · {languageLabel(language)} · {sp.level} · <b>{items.length}</b> elementos · {approved} publicados
            </>
          }
          actions={topicActions}
        >
          <p className="mt-1 text-muted-foreground">{chart.topic.intro}</p>
        </DetailHeader>
        <PhonemeSheet
          hideHeader
          language={language}
          topic={chart.topic}
          phoneme={chart.phoneme}
          itemsTitle="Fichas del tema"
          items={items.length > 0 ? renderItems(true) : <p className="text-muted-foreground">Aún no hay fichas en este tema. Usa «Editar» para añadirlas.</p>}
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 py-4">
      <ResourceBackLink kind={kind} href={kind ? `/admin/curriculum?kind=${kind}` : "/admin/curriculum"} memo="content" />

      {/* [Cabecera del tema · 2026-10-28]: DetailHeader (misma pieza que el detalle de Exámenes y Actividades) | TopicTitle va entre el título y los datos (children) */}
      <DetailHeader
        icon={<KindIcon kind={kind} className="size-8" />}
        title={sp.topic}
        meta={
          <>
            {kind ? KIND_META[kind].label : "—"} · {sp.language ? languageLabel(sp.language) : "—"} · {sp.level} · <b>{items.length}</b> elementos · {approved} publicados
          </>
        }
        actions={topicActions}
      >
        {sp.topic && sp.language && <TopicTitle topic={sp.topic} language={sp.language} className="mt-1" />}
      </DetailHeader>

      {errorBox}
      {itemGrid}
    </div>
  );
}
