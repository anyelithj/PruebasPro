import Link from "next/link"; // [Next.js]: enlaces reales → la paginación funciona sin JavaScript y es compartible
// [Pagination · 2026-10-23 · 4.º pase]: paginador ÚNICO de las tablas de Gestión — ninguna tabla lista más de TABLE_PAGE_SIZE filas
// [Patrón]: Presentational Component + URL State (?page=) | [Principio]: DRY (antes cada página repetía su <nav>) + KISS | [Paradigma]: Declarativo
// [A11y]: <nav aria-label> + aria-current="page" en la página actual (no depende solo del color)

export const TABLE_PAGE_SIZE = 10; // [SSOT]: filas por página en todas las tablas (constante nombrada, sin número mágico)

// [paginate]: recorta una lista ya cargada (filtrada en el servidor) a la página pedida | `Math.min/max` (ES): página fuera de rango → la última/primera | Función pura
export function paginate<T>(rows: ReadonlyArray<T>, rawPage: string | undefined, size = TABLE_PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(pages, Math.max(1, Number(rawPage) || 1)); // `Number(undefined)` = NaN → 1
  return { page, pages, rows: rows.slice((page - 1) * size, page * size) };
}

interface PaginationProps {
  page: number;
  pages: number;
  pathname: string;
  query: Record<string, string | undefined>; // Filtros actuales que se conservan al cambiar de página
  label?: string;
}

export function Pagination({ page, pages, pathname, query, label = "Paginación" }: PaginationProps) {
  if (pages <= 1) return null; // Una sola página → sin controles
  // `Object.fromEntries` (ES2019): sin claves vacías → URL limpia
  const base = Object.fromEntries(Object.entries(query).filter(([k, v]) => v && k !== "page")) as Record<string, string>;
  return (
    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label={label}>
      {/* `Array.from({ length }, fn)` (ES2015): genera 1..N sin bucles imperativos */}
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <Link
          key={p}
          href={{ pathname, query: p === 1 ? base : { ...base, page: String(p) } }}
          aria-current={p === page ? "page" : undefined}
          className={p === page ? "btn btn-primary btn-sm min-w-9" : "btn btn-outline btn-sm min-w-9"}
        >
          {p}
        </Link>
      ))}
    </nav>
  );
}
