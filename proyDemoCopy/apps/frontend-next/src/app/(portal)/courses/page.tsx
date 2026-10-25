import type { Metadata } from "next";
import { RememberReturn } from "@/components/shared/RememberReturn"; // [2026-10-23 · 4.º pase]: el «Volver» de los formularios regresa a esta pestaña/filtros
import Link from "next/link";
import { listCourses } from "@/lib/courses-api";
import { CourseFilter, type CourseChip } from "@/components/courses/CourseFilter";
import { CourseGrid } from "@/components/courses/CourseGrid";
import { LANGUAGE_GROUPS, type CourseFilterInput } from "@/types/courses";
import { fmt, getDictionary, plural } from "@aula/shared-i18n";
import { getLocale } from "@/lib/i18n-server"; // [i18n]: idioma desde la cookie ui-lang
// [Página /courses]: SSR del catálogo de idiomas + filtros vía URL state | [Patrón]: Container/Presentational + URL State | [Principio]: SRP | [Tecnología]: Next.js App Router (React Server Component)

// `export const metadata` (Next.js Metadata API): SEO estático; el layout raíz añade la marca con su template
export const metadata: Metadata = {
  title: "Cursos de idiomas",
  description: "Catálogo de cursos por idioma y nivel MCER (A1–C2).",
  robots: { index: false, follow: false }, // Página privada del portal: no indexar
};

// `export const dynamic = "force-dynamic"` (Next.js): render por petición (depende de la sesión del usuario)
export const dynamic = "force-dynamic";

// `interface` (TS): forma de los query params aceptados
interface SearchParams {
  chip?: string; // Idioma seleccionado (EN, FR…)
  search?: string; // Texto libre
  page?: string; // Página (1-based)
}

// [Type guard runtime]: valida el chip contra el SSOT de idiomas | `value is CourseChip` (TS) estrecha el tipo | [Principio]: Type-Safe
function isChip(value: string): value is CourseChip {
  return (LANGUAGE_GROUPS as readonly string[]).includes(value);
}

// `export default async function` (React Server Component): se ejecuta en el servidor y puede usar await
export default async function CoursesPage(props: {
  searchParams: Promise<SearchParams>; // Next.js 15+: searchParams es una Promise
}) {
  // `Promise.all` (ES2015): params e idioma en paralelo | `await` (ES2017): espera sin bloquear el event loop
  const [sp, locale] = await Promise.all([props.searchParams, getLocale()]);
  const dict = getDictionary(locale);
  const t = dict.courses; // Alias de la sección de cursos

  const chip: CourseChip | "ALL" = sp.chip && isChip(sp.chip) ? sp.chip : "ALL"; // Chip inválido → "ALL"
  const search = sp.search ?? ""; // `??` (ES2020): string vacío si no hay búsqueda
  const page = sp.page ? Math.max(1, parseInt(sp.page, 10) || 1) : 1; // Sanea la página (mínimo 1)

  // [Filtro para el backend]: el chip ES el grupo (idioma); "ALL" = sin filtro
  const filter: CourseFilterInput = {
    group: chip === "ALL" ? undefined : chip,
    search: search || undefined,
    page,
    limit: 24,
  };

  let data; // `let` (JS): se asigna dentro del try
  try {
    data = await listCourses(filter); // BFF server-side → NestJS GET /courses
  } catch (err) {
    // [Degradación elegante]: la página no se rompe si el backend no responde | [Patrón]: Graceful Degradation
    return (
      <div className="w-full space-y-5 py-4">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t.title}</h1>
        </header>
        <div
          className="rounded-xl border p-6"
          style={{
            background: "rgba(255, 107, 107, 0.08)",
            borderColor: "rgba(255, 107, 107, 0.4)",
          }}
          role="alert"
        >
          <p style={{ color: "var(--danger)" }}>
            {fmt(t.loadError, { error: err instanceof Error ? err.message : String(err) })}
          </p>
          <p className="text-xs mt-2" style={{ color: "var(--nl-txt2)" }}>
            {t.loadErrorHint}
          </p>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit)); // Páginas totales (mínimo 1)
  const heading = chip === "ALL" ? t.allLanguages : (dict.languageNames[chip] ?? chip); // Subtítulo contextual traducido

  return (
    <div className="fade-in w-full space-y-5 py-4">
      <RememberReturn memo="catalog" />
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: "var(--nl-txt)" }}>
          {t.title}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--nl-txt2)" }}>
          {/* `plural` (Intl.PluralRules): "1 curso" / "3 cursos" según el idioma */}
          {fmt(t.subtitle, { heading, count: plural(locale, data.total, t.count) })}
        </p>
      </header>

      {/* [Filtros]: Client Component que actualiza la URL (estado compartible y SEO-friendly) */}
      <CourseFilter activeChip={chip} initialSearch={search} />

      {/* [Grid]: componente presentacional; recibe datos ya resueltos en el servidor */}
      <CourseGrid
        courses={data.data}
        emptyMessage={search ? fmt(t.noResults, { q: search }) : t.empty}
      />

      {/* [Paginación]: enlaces reales (<a>) → navegables sin JS y accesibles */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 mt-8" aria-label={t.pagination}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={{ pathname: "/courses", query: { ...sp, page: String(p) } }}
              aria-current={p === data.page ? "page" : undefined}
              className={p === data.page ? "btn btn-primary btn-sm min-w-9" : "btn btn-outline btn-sm min-w-9"} // [Sistema de diseño]: misma paginación en toda la app
            >
              {p}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
