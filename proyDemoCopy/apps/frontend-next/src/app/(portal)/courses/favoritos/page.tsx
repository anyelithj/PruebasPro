import type { Metadata } from "next"; // `import type` (TS): solo el tipo de la Metadata API de Next.js
import Link from "next/link";
import { getDictionary } from "@aula/shared-i18n";
import { getMyFavorites } from "@/lib/courses-api";
import { getLocale } from "@/lib/i18n-server"; // [i18n]: idioma desde la cookie ui-lang
import { CourseGrid } from "@/components/courses/CourseGrid"; // [DRY]: la MISMA rejilla y card del catálogo (con la barra ⭐ 👍 ❤️)
import { Pagination } from "@/components/shared/Pagination";
// [Página /courses/favoritos · Caso F · 2026-11-13]: «Mis favoritos» del estudiante — cursos guardados con ⭐, paginados en el SERVIDOR (GET /me/favorites)
// [Patrón]: Container (RSC) + Presentational (CourseGrid) + URL State (?page) | [Principio]: SRP + DRY | [Seguridad]: la ruta del portal exige sesión (proxy.ts) y NestJS solo devuelve los del usuario del JWT
// [SEO]: página privada → noindex | [Tecnología]: Next.js App Router (React Server Component)

export const metadata: Metadata = { title: "Mis favoritos", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic"; // `force-dynamic` (Next.js): depende de la sesión → render por petición

// [Pestañas · 2026-11-16]: ⭐ guardados · 👍 me gusta · ❤️ me encanta (?tipo=) → se ve dónde quedó cada marca
const KINDS = ["favorite", "like", "love"] as const;
type Kind = (typeof KINDS)[number];
const ICON: Record<Kind, string> = { favorite: "⭐", like: "👍", love: "❤️" };

export default async function FavoritesPage(props: { searchParams: Promise<{ page?: string; tipo?: string }> }) {
  // `Promise.all` (ES2015): parámetros e idioma en paralelo | `searchParams` es una Promise en Next.js 16
  const [sp, locale] = await Promise.all([props.searchParams, getLocale()]);
  const dict = getDictionary(locale).courses;
  const t = dict.favorites;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1); // Sanea la página (mínimo 1)
  const kind: Kind = KINDS.find((k) => k === sp.tipo) ?? "favorite"; // Valor desconocido → ⭐
  const data = await getMyFavorites(page, 12, kind);
  const empty = kind === "like" ? t.emptyLike : kind === "love" ? t.emptyLove : t.empty;
  const pages = Math.ceil(data.total / data.limit); // `Math.ceil` (JS): páginas totales

  return (
    <div className="fade-in w-full space-y-5 py-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="title-page">{t.title}</h1>
          <p className="mt-1 text-muted-foreground">{t.subtitle}</p>
        </div>
        <Link href="/courses" className="btn btn-outline">
          {t.browse}
        </Link>
      </header>
      <nav aria-label={t.tabs} className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Link key={k} href={k === "favorite" ? "/courses/favoritos" : `/courses/favoritos?tipo=${k}`} aria-current={k === kind ? "page" : undefined} className={`btn btn-sm ${k === kind ? "btn-primary" : "btn-outline"}`}>
            <span aria-hidden>{ICON[k]}</span> {dict.actions[k]}
          </Link>
        ))}
      </nav>
      {/* Quitar la marca aquí refresca la lista (router.refresh en useCourseEngagement) */}
      <CourseGrid courses={data.data} emptyMessage={empty} />
      <Pagination page={data.page} pages={pages} pathname="/courses/favoritos" query={kind === "favorite" ? {} : { tipo: kind }} label={t.title} />
    </div>
  );
}
