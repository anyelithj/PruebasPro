import type { ComponentProps, ReactNode } from "react";
import type Link from "next/link";
import { FilterSelect } from "./FilterSelect";
// [FilterPanel · 2026-11-11]: panel de filtros ÚNICO de Gestión (Recursos, Actividades, Cursos, Certificados) y de las secciones del estudiante (Recursos, Cursos)
// Buscar + selects + campos extra · «Filtrar» y «Limpiar» · debajo, las pestañas de idioma | <form method="get"> nativo → URL compartible, funciona sin JavaScript
// [Fix «Limpiar no limpia nada»]: los campos son no controlados (defaultValue) y React reutilizaba el MISMO <form> al navegar → conservaban lo escrito
// `key` con los valores actuales → al cambiar la URL el formulario se vuelve a montar con los valores nuevos (vacíos tras «Limpiar»)
// [Patrón]: Presentational (RSC) | [Principio]: DRY (un panel para todas las tablas) | [A11y]: etiquetas visibles, aria-label del formulario

type SelectProps = ComponentProps<typeof FilterSelect>;

export interface FilterPanelProps {
  label: string; // aria-label del formulario («Filtros de recursos»)
  clearHref: ComponentProps<typeof Link>["href"]; // Destino de «Limpiar» (sin filtros; conserva la pestaña si la hay)
  hidden?: Record<string, string | undefined>; // Parámetros que no se editan aquí (pestaña, tipo, idioma de los chips)
  search?: { name?: string; value?: string; placeholder: string; label?: string };
  selects?: ReadonlyArray<SelectProps>;
  children?: ReactNode; // Campos extra (p. ej. fechas) con el mismo estilo
  extraKey?: string; // Valores actuales de los campos extra → entran en la `key` (se vacían con «Limpiar»)
  chips?: ReactNode; // Pestañas de idioma (LanguageChips) debajo de la fila de filtros
  submitLabel?: string;
  clearLabel?: string;
}

export function FilterPanel({ label, clearHref, hidden = {}, search, selects = [], children, extraKey = "", chips, submitLabel = "Filtrar", clearLabel = "Limpiar" }: FilterPanelProps) {
  const searchName = search?.name ?? "search";
  const key = JSON.stringify([hidden, search?.value ?? "", selects.map((s) => s.value ?? ""), extraKey]);
  return (
    <section aria-label="Filtros" className="surface flex flex-col gap-3 p-4">
      <form key={key} method="get" autoComplete="off" className="flex flex-wrap items-end gap-3" aria-label={label}>
        {Object.entries(hidden).map(([name, value]) => value && <input key={name} type="hidden" name={name} value={value} />)}
        {search && (
          <div className="min-w-48 flex-[2]">
            <label htmlFor={`f-${searchName}`} className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {search.label ?? "Buscar"}
            </label>
            <input id={`f-${searchName}`} name={searchName} type="search" defaultValue={search.value ?? ""} placeholder={search.placeholder} className="control w-full" />
          </div>
        )}
        {selects.map((s) => (
          <FilterSelect key={s.name} {...s} />
        ))}
        {children}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="btn btn-primary">
            {submitLabel}
          </button>
          {/* [Fix 2026-11-11 · «Limpiar no limpia»]: <a> = navegación COMPLETA → el formulario nace de cero con la URL sin filtros (no depende de que React reutilice o no los campos) */}
          <a href={toUrl(clearHref)} className="btn btn-ghost">
            {clearLabel}
          </a>
        </div>
      </form>
      {chips}
    </section>
  );
}

// [toUrl]: href de <Link> (texto u objeto { pathname, query }) → URL de texto | `URLSearchParams` (Web API) | Función pura
function toUrl(href: FilterPanelProps["clearHref"]): string {
  if (typeof href === "string") return href;
  const u = href as { pathname?: string | null; query?: Record<string, string | undefined> | string | null };
  const q = typeof u.query === "string" ? u.query : new URLSearchParams(Object.entries(u.query ?? {}).filter((e): e is [string, string] => Boolean(e[1]))).toString();
  return `${u.pathname ?? ""}${q ? `?${q}` : ""}`;
}

// [FilterField]: campo extra con la MISMA etiqueta que FilterSelect (p. ej. fechas) | `children` = el control (con id = `f-${name}`)
export function FilterField({ name, label, children }: { name: string; label: string; children: ReactNode }) {
  return (
    <div className="min-w-36 flex-1">
      <label htmlFor={`f-${name}`} className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
