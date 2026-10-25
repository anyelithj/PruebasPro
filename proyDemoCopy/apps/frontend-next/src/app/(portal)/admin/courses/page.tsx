import type { Metadata } from "next"; // [Next.js]: tipo de la Metadata API | `import type` (TS): se borra al compilar
import { RememberReturn } from "@/components/shared/RememberReturn"; // [2026-10-23 · 4.º pase]: el «Volver» de los formularios regresa a esta pestaña/filtros
import Link from "next/link";
import { listCoursesAdmin } from "@/lib/courses-api"; // [Facade]: GET /courses/admin (incluye borradores; el backend exige ADMIN)
import { getLocale } from "@/lib/i18n-server";
import { fmt, getDictionary, INTL_LOCALE, plural } from "@aula/shared-i18n";
import { ManagementHeader } from "@/components/portal/ManagementHeader";
import { CourseBadge } from "@/components/courses/CourseBadge";
import { courseGroupColor, type PaginatedCoursesResponse } from "@/types/courses";
import { TABLE_PAGE_SIZE } from "@/components/shared/Pagination";
import { RowActions } from "@/components/admin/RowActions"; // [CRUD por fila]: ver · editar · publicar · eliminar
import { deleteCourseAction, setCoursePublishedAction } from "./actions";
// [Página /admin/courses]: pestaña "Cursos" de Gestión — listado administrativo + acceso a crear | [Patrón]: Container (RSC) + URL State (página en query) | [Principio]: SRP | [Paradigma]: Declarativo

export const metadata: Metadata = {
  title: "Gestión · Cursos",
  description: "Gestión de cursos de idiomas (ADMIN).",
  robots: { index: false, follow: false }, // Página privada: no indexar | [SEO]
};

export const dynamic = "force-dynamic"; // Depende de la sesión (cookie) → render por petición

const PAGE_SIZE = TABLE_PAGE_SIZE; // [2026-10-23 · 4.º pase]: 10 filas por página (antes 20) — SSOT compartido

// `export default async function` (RSC): corre en el servidor, puede usar await
export default async function AdminCoursesPage(props: { searchParams: Promise<{ page?: string }> }) {
  const [sp, locale] = await Promise.all([props.searchParams, getLocale()]); // `Promise.all` (ES2015): lecturas en paralelo
  const t = getDictionary(locale);
  const page = Math.max(1, Number(sp.page) || 1); // Sanea la página (NaN → 1)

  let data: PaginatedCoursesResponse; // `let` (ES2015): se asigna en try/catch
  let error: string | null = null;
  try {
    data = await listCoursesAdmin({ page, limit: PAGE_SIZE });
  } catch (err) {
    // [Degradación elegante]: la pestaña se muestra con el error, sin romper la navegación | [Patrón]: Graceful Degradation
    error = err instanceof Error ? err.message : String(err);
    data = { data: [], total: 0, page: 1, limit: PAGE_SIZE };
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));
  // `Intl.NumberFormat` (ECMA-402): moneda con el formato del idioma activo (stdlib, sin librerías)
  const money = (value: number, currency: string) =>
    new Intl.NumberFormat(INTL_LOCALE[locale], { style: "currency", currency }).format(value);

  return (
    <div className="w-full space-y-5 py-4">
      <RememberReturn memo={["courses", "catalog"]} />
      <ManagementHeader role="admin" active="courses" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">{plural(locale, data.total, t.adminCourses.count)}</p>
        <Link
          href="/admin/courses/new"
          className="btn btn-primary"
        >
          {t.adminCourses.create}
        </Link>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {fmt(t.adminCourses.loadError, { error })}
        </p>
      )}

      {/* [Tabla]: overflow-x-auto → responsive en móvil | <th scope="col"> → accesible para lectores de pantalla */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">{t.adminCourses.columns.title}</th>
              <th scope="col" className="px-4 py-3">{t.adminCourses.columns.language}</th>
              <th scope="col" className="px-4 py-3">{t.adminCourses.columns.level}</th>
              <th scope="col" className="px-4 py-3">{t.adminCourses.columns.price}</th>
              <th scope="col" className="px-4 py-3">{t.adminCourses.columns.status}</th>
              <th scope="col" className="px-4 py-3">{t.adminCourses.columns.actions}</th>
            </tr>
          </thead>
          <tbody>
            {data.data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {t.adminCourses.empty}
                </td>
              </tr>
            ) : (
              data.data.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-4 py-2">
                    <Link href={`/courses/${c.slug || c.id}`} className="font-semibold text-primary hover:underline">
                      {c.title}
                    </Link>
                    <div className="font-mono text-[11px] text-muted-foreground">{c.slug}</div>
                  </td>
                  <td className="px-4 py-2">
                    {/* `??` (ES2020): grupo legacy sin traducción → se muestra el código crudo */}
                    <CourseBadge text={t.languageNames[c.group] ?? c.group} color={c.color || courseGroupColor(c.group)} />
                  </td>
                  <td className="px-4 py-2 font-semibold">{c.category}</td>
                  <td className="px-4 py-2 eeg-mono">{c.isFree ? t.adminCourses.free : money(c.price, c.currency)}</td>
                  <td className="px-4 py-2">
                    {c.isPublished ? (
                      <span className="font-semibold text-primary">{t.adminCourses.published}</span>
                    ) : (
                      <span className="text-muted-foreground">{t.adminCourses.draft}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {/* `.bind(null, id)` (JS): Server Action con el id ya aplicado → el cliente solo la invoca | [Patrón]: Partial Application */}
                    <RowActions
                      title={c.title}
                      viewHref={`/courses/${c.slug || c.id}`}
                      editHref={`/admin/courses/${c.id}/edit`}
                      publish={{ isPublished: c.isPublished, toggle: setCoursePublishedAction.bind(null, c.id, !c.isPublished) }}
                      onDelete={deleteCourseAction.bind(null, c.id)}
                      deleteTitle={`${t.management.row.delete} · ${t.management.tabs.courses}`}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="flex justify-center gap-2" aria-label={t.courses.pagination}>
          {/* `Array.from({ length }, fn)` (ES2015): genera 1..N sin bucles imperativos */}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={{ pathname: "/admin/courses", query: { page: String(p) } }}
              aria-current={p === data.page ? "page" : undefined}
              className={
                p === data.page
                  ? "btn btn-primary btn-sm min-w-9"
                  : "btn btn-outline btn-sm min-w-9"
              }
            >
              {p}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
