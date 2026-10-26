import { KindIcon } from "@/components/shared/KindIcon"; // [2026-10-23]: portada con icono SVG (antes emoji)
import type { Metadata } from "next";
import { DownloadMenu } from "@/components/curriculum/DownloadMenu"; // [2026-10-23]: descargar las fichas del tema
import { BackLink } from "@/components/shared/BackLink"; // [2026-10-24]: enlace «Volver» único (recuerda filtros)
import { listCurriculum } from "@/lib/curriculum-api";
import { languageLabel } from "@/lib/languages";
import { fmt, getDictionary, plural } from "@aula/shared-i18n";
import { getLocale } from "@/lib/i18n-server";
import { ResourcePreview } from "@/components/curriculum/ResourcePreview";
import { backLabel, KIND_META, KINDS, type CurriculumItem, type CurriculumItemKind } from "@/types/curriculum";
import { TopicTitle } from "@/components/language/TopicTitle"; // [2026-10-19]: tema en el idioma estudiado con IPA, audio y traducción
// [Página /resources/tema]: todas las fichas de un tema (idioma + nivel) — vocabulario con emoji/imagen y audio de pronunciación | [Patrón]: Container (RSC) + Presentational (ResourcePreview) | [Principio]: SRP + DRY | [Paradigma]: Declarativo
// [Rendimiento]: una sola consulta filtrada por tema (máx. 100); solo los botones 🔊 se hidratan en el cliente

export const metadata: Metadata = { title: "Tema de estudio", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic"; // Depende de la sesión (cookies)

interface SearchParams {
  topic?: string;
  language?: string;
  level?: string;
  kind?: string;
}

export default async function TopicPage(props: { searchParams: Promise<SearchParams> }) {
  const [sp, locale] = await Promise.all([props.searchParams, getLocale()]);
  const t = getDictionary(locale).resources;
  const kind = KINDS.includes(sp.kind as CurriculumItemKind) ? (sp.kind as CurriculumItemKind) : undefined; // Valida contra el SSOT

  let items: CurriculumItem[] = [];
  let loadError: string | null = null;
  if (sp.topic) {
    try {
      const res = await listCurriculum({ topic: sp.topic, language: sp.language, level: sp.level, kind, status: "approved", limit: 100 });
      items = res.data;
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
    }
  }
  // [Orden]: vocabulario primero (fichas), luego el resto por tipo | `toSorted` no se usa (compatibilidad) → copia + sort
  const ordered = [...items].sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));

  return (
    <div className="fade-in w-full space-y-5 py-4">
      {/* [Volver · 2026-10-24]: el MISMO BackLink que el resto (antes «← Todos los temas») · `memo` → regresa al tipo/idioma/nivel filtrados */}
      {/* [Texto por tipo · 2026-10-24]: «Volver a vocabulario», «Volver a pronunciación»… (BACK_LABEL, SSOT) · sin tipo → texto genérico traducido */}
      <BackLink href={`/resources?${new URLSearchParams(Object.entries({ language: sp.language, level: sp.level, kind }).filter((e): e is [string, string] => Boolean(e[1])))}`} memo="resources">
        {kind ? backLabel(kind) : t.back}
      </BackLink>

      <header className="flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-tone-brand-soft text-tone-brand">
          <KindIcon kind={kind} className="size-8" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{sp.topic ?? t.title}</h1>
          {sp.topic && sp.language && <TopicTitle topic={sp.topic} language={sp.language} className="mt-1" />}
          <p className="mt-1 text-sm text-muted-foreground">
            {fmt(t.topicSubtitle, { language: sp.language ? languageLabel(sp.language) : "—", level: sp.level ?? "—", count: plural(locale, items.length, t.count) })}
          </p>
        </div>
        {/* [Descargar · 2026-10-23]: el estudiante descarga las fichas publicadas del tema (NestJS filtra a aprobadas) */}
        {items.length > 0 && (
          <div className="ml-auto">
            <DownloadMenu filters={{ topic: sp.topic, language: sp.language, level: sp.level, kind, status: "approved" }} />
          </div>
        )}
      </header>

      {loadError && (
        <p role="alert" className="rounded-lg border border-tone-danger-line bg-tone-danger-soft p-4 text-sm text-tone-danger">
          {fmt(t.loadError, { error: loadError })}
        </p>
      )}

      {!loadError && ordered.length === 0 ? (
        <p role="status" className="surface p-10 text-center text-sm text-muted-foreground">
          {t.empty}
        </p>
      ) : (
        // [Fichas]: grid responsivo; cada ficha muestra imagen/emoji, palabra, IPA, traducción, ejemplos y audio
        <ul className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {ordered.map((it) => {
            const meta = KIND_META[it.kind];
            return (
              <li key={it.id} className="surface flex flex-col overflow-hidden" style={{ borderTop: "3px solid var(--primary)" }}>
                <header className="flex items-center justify-between gap-2 border-b border-border bg-muted px-4 py-2">
                  <span className="badge bg-tone-brand-soft text-tone-brand">
                    <span aria-hidden>{meta.icon}</span> {meta.label}
                  </span>
                  <span className="text-[11px] font-bold">{it.level}</span>
                </header>
                {/* `lang` (HTML): el lector de pantalla pronuncia la palabra en su idioma */}
                <div className="flex-1 p-4" lang={it.language}>
                  <ResourcePreview kind={it.kind} content={it.content} language={it.language} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
