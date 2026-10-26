import type { Metadata } from "next";
import { RememberReturn } from "@/components/shared/RememberReturn"; // [2026-10-23 · 4.º pase]: el «Volver» de los formularios regresa a esta pestaña/filtros
import Link from "next/link";
import { LayoutGrid, Plus } from "lucide-react";
import { getCurrentUserPayload } from "@/lib/auth";
import { ACTIVITY_TAB_KEYS, ACTIVITY_TABS, BLOCKER_LABEL, listActivities, parseTab, STATUS_LABEL, withReturn, type ActivityRow, type ActivityTab } from "@/lib/activities-api";
import { LANGUAGES, languageLabel } from "@/lib/languages";
import { CEFR_LEVELS } from "@/lib/constants";
import { ManagementHeader } from "@/components/portal/ManagementHeader";
import { toPortalRole } from "@/components/portal/portal-role";
import { RowActions } from "@/components/admin/RowActions";
import { FilterSelect } from "@/components/admin/FilterSelect";
import { Pagination, paginate } from "@/components/shared/Pagination"; // [2026-10-23 · 4.º pase]: máx. 10 filas por página
import { deleteActivityAction, setActivityPublishedAction } from "./actions";
// [Página /admin/activities · 2026-10-23]: Gestión → Actividades con el MISMO diseño que Gestión → Recursos — barra (resumen + botón primario), pestañas por sección
// con icono (chips), filtros GET (buscar, idioma, nivel, estado) y tabla con Ver · Editar · Eliminar
// [Patrón]: Container (RSC) + URL State (?tab=&search=…) + Configuration Object (ACTIVITY_TABS) | [Principio]: OCP + DRY (RowActions, FilterSelect, ManagementHeader) | [Paradigma]: Declarativo
// `<a>` y no `<Link>` para crear/ver/editar: son pantallas del remoto Angular (rewrites) → navegación completa

export const metadata: Metadata = {
  title: "Gestión · Actividades",
  description: "Crea, edita, revisa y elimina actividades: práctica, juegos, música, diálogos, poliglota y lectura.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic"; // El rol y la sesión deciden la lista

interface SearchParams {
  tab?: string;
  search?: string;
  language?: string;
  level?: string;
  status?: string;
  page?: string; // [Paginación]: página de la tabla
}

// [href]: URL de la pestaña conservando filtros | `Object.fromEntries` (ES2019): sin claves vacías → URL limpia
const href = (sp: SearchParams, patch: Partial<SearchParams>) => ({
  pathname: "/admin/activities",
  query: Object.fromEntries(Object.entries({ ...sp, ...patch }).filter(([, v]) => v)) as Record<string, string>,
});

// [matches]: filtros aplicados en el servidor (las secciones no comparten los mismos parámetros en NestJS) | Función pura
const matches = (r: ActivityRow, sp: SearchParams) =>
  (!sp.search || `${r.title} ${r.description}`.toLowerCase().includes(sp.search.toLowerCase())) &&
  (!sp.language || r.language === sp.language) &&
  (!sp.level || (r.level ?? "").includes(sp.level)) &&
  (!sp.status || r.status === sp.status);

export default async function ActivitiesManagementPage(props: { searchParams: Promise<SearchParams> }) {
  const [sp, user] = await Promise.all([props.searchParams, getCurrentUserPayload()]);
  const role = toPortalRole(user?.role ?? null);
  const tab: ActivityTab = parseTab(sp.tab);
  const def = ACTIVITY_TABS[tab];
  const TabIcon = def.icon;

  let rows: ActivityRow[] = [];
  let loadError: string | null = null;
  try {
    rows = (await listActivities(tab, "mine")).filter((r) => matches(r, sp));
  } catch (err) {
    loadError = err instanceof Error ? err.message : "error desconocido";
  }
  const pg = paginate(rows, sp.page); // [Tabla]: solo 10 filas por página

  return (
    <div className="w-full space-y-5 py-4">
      <RememberReturn memo="activities" />
      <ManagementHeader role={role} active="activities" />

      {/* [Barra de la pestaña]: MISMO patrón que Recursos → resumen a la izquierda y botones de alta a la derecha, centrados en vertical */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {def.description}{" "}
          <b className="text-foreground">
            {rows.length} elemento{rows.length === 1 ? "" : "s"}
          </b>
          .
        </p>
        {/* [Crear actividad · 2026-10-23 · 4.º pase]: UN botón como «Crear recurso» → página con «¿Qué vas a crear?» (sección) y «¿Cómo?» (a mano, IA, importar) */}
        <Link href={{ pathname: "/admin/activities/new", query: { tab } }} className="btn btn-primary">
          <Plus aria-hidden className="size-4" /> Crear actividad
        </Link>
      </div>

      {/* [Pestañas por sección]: chips con icono SVG y aria-current (navegables sin JS), como los tipos de Recursos */}
      <nav aria-label="Sección de actividades" className="flex flex-wrap gap-1.5">
        {ACTIVITY_TAB_KEYS.map((k) => {
          const Icon = ACTIVITY_TABS[k].icon;
          return (
            <Link key={k} href={href({}, { tab: k })} aria-current={k === tab ? "page" : undefined} className="chip">
              <Icon aria-hidden className="size-4" /> {ACTIVITY_TABS[k].label}
            </Link>
          );
        })}
      </nav>

      {/* [Filtros]: GET nativo → URL compartible | cada select con etiqueta visible */}
      {tab !== "games" && (
        <form method="get" className="surface flex flex-wrap items-end gap-3 p-4" aria-label="Filtros de actividades">
          <input type="hidden" name="tab" value={tab} />
          <div className="min-w-48 flex-[2]">
            <label htmlFor="f-search" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Buscar
            </label>
            <input id="f-search" name="search" type="search" defaultValue={sp.search ?? ""} placeholder="Título o descripción…" className="control w-full" />
          </div>
          <FilterSelect name="language" label="Idioma" value={sp.language} all="Todos" options={LANGUAGES.map((l) => ({ value: l.value, label: l.label }))} />
          <FilterSelect name="level" label="Nivel" value={sp.level} all="Todos" options={CEFR_LEVELS.map((l) => ({ value: l, label: l }))} />
          <FilterSelect name="status" label="Estado" value={sp.status} all="Todos" options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn btn-primary">
              Filtrar
            </button>
            <Link href={href({}, { tab })} className="btn btn-ghost">
              Limpiar
            </Link>
          </div>
        </form>
      )}

      {loadError && (
        <p role="alert" className="rounded-lg border border-tone-danger-line bg-tone-danger-soft p-4 text-sm text-tone-danger">
          No se pudo cargar la lista: {loadError}
        </p>
      )}

      {rows.length === 0 && !loadError ? (
        // [Estado vacío]: explica qué hacer (no solo "sin datos")
        <div role="status" className="surface p-10 text-center">
          <LayoutGrid aria-hidden className="mx-auto size-10 text-tone-brand" />
          <p className="mt-2 text-sm text-muted-foreground">No hay {def.label.toLowerCase()} con estos filtros.</p>
          <Link href={{ pathname: "/admin/activities/new", query: { tab } }} className="btn btn-primary mt-4">
            <Plus aria-hidden className="size-4" /> Crear actividad
          </Link>
        </div>
      ) : (
        // [Tabla]: overflow-x-auto solo en la tabla (responsive) | <th scope="col"> → accesible
        rows.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">Título</th>
                  <th scope="col" className="px-4 py-3">Sección</th>
                  <th scope="col" className="px-4 py-3">Idioma · nivel</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                  <th scope="col" className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pg.rows.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-2">
                      <a href={`/admin/activities/ver/${tab}/${encodeURIComponent(r.id)}`} className="flex items-center gap-2 font-semibold text-primary hover:underline">
                        <TabIcon aria-hidden className="size-5 shrink-0" />
                        {r.title}
                      </a>
                      {r.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{r.description}</p>}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <TabIcon aria-hidden className="size-4" /> {def.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {r.language ? languageLabel(r.language) : "—"}
                      {r.level && (
                        <>
                          {" "}· <b>{r.level}</b>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {r.status ? (
                        <span className={`badge ${r.status === "published" ? "bg-tone-brand-soft text-tone-brand" : "bg-tone-warning-soft text-tone-warning"}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {/* [2026-10-24 · Checklist]: requisitos que faltan para publicar (antes «Publicar» fallaba en el servidor con «Falta subir el audio») → enlace directo a completarlos */}
                      {r.status !== "published" && r.blockers?.length ? (
                        <p className="mt-1 text-[11px] leading-tight text-tone-warning">
                          Para publicar falta: {r.blockers.map((b) => BLOCKER_LABEL[b] ?? b).join(", ")}.{" "}
                          {r.editHref && (
                            <a href={withReturn(r.editHref, tab)} className="font-semibold underline">
                              Completar
                            </a>
                          )}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2">
                      <RowActions
                        hard
                        confirm="inline" // [2026-10-24 · Sin modales]: confirmar el borrado dentro de la fila
                        title={r.title}
                        viewHref={`/admin/activities/ver/${tab}/${encodeURIComponent(r.id)}`} // [2026-10-25]: «Ver» = revisión (vista previa + publicar), como en Recursos
                        editHref={r.editHref ? withReturn(r.editHref, tab) : undefined}
                        // [Publicar / Despublicar · 2026-10-23]: igual que Recursos; solo en secciones con estado (no juegos ni diálogos)
                        // [2026-10-24]: sin «Publicar» mientras falten requisitos (la celda Estado dice cuáles); «Despublicar» siempre disponible
                        publish={def.publish && r.status && (r.status === "published" || !r.blockers?.length) ? { isPublished: r.status === "published", toggle: setActivityPublishedAction.bind(null, tab, r.id, r.status !== "published") } : undefined}
                        onDelete={def.remove ? deleteActivityAction.bind(null, tab, r.id) : undefined}
                        deleteTitle={`Eliminar «${r.title}»${def.removeNote ? ` · ${def.removeNote}` : ""}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      <Pagination page={pg.page} pages={pg.pages} pathname="/admin/activities" query={{ ...sp, tab }} />
    </div>
  );
}
