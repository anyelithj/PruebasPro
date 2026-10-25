import { RememberReturn } from "@/components/shared/RememberReturn"; // [2026-10-24]: lugar de regreso del «Volver»
import { Library } from "lucide-react"; // [2026-10-23]: icono SVG del estado vacío (antes emoji)
import { KindIcon } from "@/components/shared/KindIcon"; // [2026-10-23]: iconos SVG uniformes por tipo de recurso
import type { Metadata } from "next";
import Link from "next/link";
import { listTopicGroups } from "@/lib/curriculum-api";
import { LANGUAGES, languageLabel } from "@/lib/languages";
import { fmt, getDictionary, plural } from "@aula/shared-i18n";
import { getLocale } from "@/lib/i18n-server";
import { KIND_META, KINDS, RESOURCE_KINDS, type CurriculumItemKind, type TopicGroup } from "@/types/curriculum";
import { PolyglotNavLink } from "@/components/language/PolyglotNavLink"; // [Sprint 10.14]: opción «Poliglota» junto a los siete idiomas
import { IpaChart } from "@/components/language/IpaChart"; // [2026-10-23]: alfabeto fonético por temas en Recursos › Pronunciación
import { CEFR_LEVELS } from "@/lib/constants"; // [SSOT niveles MCER]: misma lista en todo el frontend | [Principio]: DRY
// [Página /resources]: "Recursos" del menú — material PUBLICADO agrupado POR TEMA (una tarjeta por tema + idioma + nivel); al abrirla se ven todas sus fichas | [Patrón]: Container (RSC) + URL State + Read Model | [Principio]: SRP | [Paradigma]: Declarativo
// [Seguridad]: siempre se pide status=approved; además el backend ya limita a aprobados para estudiantes

export const metadata: Metadata = {
  title: "Recursos de estudio",
  description: "Vocabulario, reglas gramaticales, ejemplos, pronunciación y ejercicios por idioma y nivel MCER.",
  robots: { index: false, follow: false }, // Privada del portal
};

export const dynamic = "force-dynamic"; // Depende de la sesión e idioma (cookies)

interface SearchParams {
  kind?: string;
  language?: string;
  level?: string;
  search?: string;
}


// [clean]: quita claves vacías de un objeto de query | [Paradigma]: Funcional (pura)
const clean = (o: Record<string, string | undefined>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v)) as Record<string, string>;

// [href]: URL conservando filtros | [Principio]: DRY
const href = (sp: SearchParams, patch: Partial<SearchParams>) => ({ pathname: "/resources", query: clean({ ...sp, ...patch }) });

// [topicHref]: página del tema con su idioma y nivel (y el tipo si está filtrado)
const topicHref = (g: TopicGroup, kind?: string) => ({ pathname: "/resources/tema", query: clean({ topic: g.topic, language: g.language, level: g.level, kind }) });

export default async function ResourcesPage(props: { searchParams: Promise<SearchParams> }) {
  const [sp, locale] = await Promise.all([props.searchParams, getLocale()]);
  const t = getDictionary(locale).resources;
  const activeKind = KINDS.includes(sp.kind as CurriculumItemKind) ? (sp.kind as CurriculumItemKind) : undefined; // Valida contra el SSOT

  let groups: TopicGroup[] = [];
  let loadError: string | null = null;
  try {
    groups = await listTopicGroups({ language: sp.language, level: sp.level, kind: activeKind, status: "approved" });
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }
  const total = groups.reduce((n, g) => n + g.count, 0); // `reduce` (ES5): recursos totales

  return (
    <div className="fade-in w-full space-y-5 py-4">
      <RememberReturn memo="resources" /> {/* [2026-10-24]: el «Volver a recursos» del tema regresa a estos filtros */}
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{fmt(t.subtitle, { count: plural(locale, total, t.count) })} · {plural(locale, groups.length, t.topics)}</p>
      </header>

      {/* [Chips de tipo]: enlaces con aria-current (navegables sin JS) */}
      <nav aria-label={t.kindsLabel} className="flex flex-wrap gap-1.5">
        <Link href={href(sp, { kind: undefined })} aria-current={!activeKind ? "page" : undefined} className="chip">
          <KindIcon /> {t.all}
        </Link>
        {RESOURCE_KINDS.filter((k) => k !== "rubric").map((k) => ( // [2026-10-23 · 4.º pase]: sin «Traducción» (menú «Traductor»)
          // Rúbricas: herramienta del docente → no se listan a estudiantes
          <Link key={k} href={href(sp, { kind: k })} aria-current={activeKind === k ? "page" : undefined} className="chip">
            <KindIcon kind={k} /> {KIND_META[k].label}
          </Link>
        ))}
      </nav>

      {/* [Filtros]: GET nativo con etiquetas visibles */}
      <form method="get" className="surface flex flex-wrap items-end gap-3 p-4">
        {activeKind && <input type="hidden" name="kind" value={activeKind} />}
        <div className="min-w-36 flex-1">
          <label htmlFor="r-language" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t.language}
          </label>
          <select id="r-language" name="language" defaultValue={sp.language ?? ""} className="control w-full">
            <option value="">{t.allLanguages}</option>
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-28 flex-1">
          <label htmlFor="r-level" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t.level}
          </label>
          <select id="r-level" name="level" defaultValue={sp.level ?? ""} className="control w-full">
            <option value="">{t.allLevels}</option>
            {CEFR_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          {t.filter}
        </button>
        {/* [Poliglota]: comparar un tema en varios idiomas (remoto Angular) */}
        <PolyglotNavLink locale={locale} />
      </form>

      {/* [Pronunciación · 2026-10-23]: con el tipo «Pronunciación» (inglés o todos los idiomas) se listan los temas del alfabeto IPA y sus reglas antes de los temas del docente */}
      {activeKind === "pronunciation" && (!sp.language || sp.language === "en") && <IpaChart />}

      {loadError && (
        <p role="alert" className="rounded-lg border border-tone-danger-line bg-tone-danger-soft p-4 text-sm text-tone-danger">
          {fmt(t.loadError, { error: loadError })}
        </p>
      )}

      {groups.length === 0 && !loadError ? (
        <div role="status" className="surface p-10 text-center text-sm text-muted-foreground">
          <Library aria-hidden className="mx-auto mb-2 size-10 text-tone-brand" />
          {t.empty}
        </div>
      ) : (
        // [Tarjetas por tema]: <ul> semántico + grid auto-fill (1 → 4 columnas); cada tarjeta es un enlace a sus fichas
        <ul aria-label={t.topicsLabel} className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
          {groups.map((g) => (
            <li key={`${g.topic}|${g.language}|${g.level}`}>
              <Link
                href={topicHref(g, activeKind)}
                aria-label={fmt(t.openTopic, { topic: g.topic, count: plural(locale, g.count, t.count) })}
                className="surface group flex h-full flex-col overflow-hidden transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ borderTop: "3px solid var(--primary)" }}
              >
                <div className="flex flex-1 items-center gap-3 p-4">
                  {/* [Portada]: emoji del vocabulario del tema o icono del primer tipo */}
                  <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-tone-brand-soft text-tone-brand">
                    <KindIcon kind={g.kinds[0]} className="size-7" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-bold leading-tight group-hover:text-primary">{g.topic}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {languageLabel(g.language)} · {g.level} · {plural(locale, g.count, t.count)}
                    </span>
                  </span>
                </div>
                <span className="flex flex-wrap gap-1 border-t border-border bg-muted px-4 py-2">
                  {g.kinds.map((k) => (
                    <span key={k} className="badge bg-tone-brand-soft text-tone-brand">
                      <KindIcon kind={k} className="size-3.5" /> {KIND_META[k]?.label ?? k}
                    </span>
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
