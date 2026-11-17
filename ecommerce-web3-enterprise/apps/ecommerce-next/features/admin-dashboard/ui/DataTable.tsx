// DataTable.tsx (Client Component) => tabla de datos genérica del panel: columnas declarativas, estados de carga y
// vacío, paginación y acciones por fila. Patrones: Composite (columnas como datos) + Template Method (la tabla fija la
// estructura; cada sección aporta columnas). Tipado seguro con genéricos "<T>".
// Accesibilidad: <table> semántica con <caption>, <th scope="col">, aria-busy durante la carga; responsive: en móvil las
// filas se apilan como bloques (la página nunca se desborda).
"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { PaginationMeta } from "@/shared/types/api.types";
import { Button } from "@/shared/ui/Button";
import { Skeleton } from "@/shared/ui/Skeleton";
import { cn } from "@/shared/lib/cn";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode; // Render de la celda (Strategy por columna)
  className?: string;
}

interface DataTableProps<T> {
  caption: string; // Título accesible de la tabla (visible solo para lectores de pantalla)
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  meta?: PaginationMeta | undefined;
  onPage?: (page: number) => void;
  empty?: string;
  onRowClick?: (row: T) => void;
}

// LOCAL_PAGE => filas por página cuando la lista llega completa (sin paginación del servidor): mismo tamaño que
// PAGE_SIZE de AdminResource => ninguna tabla del panel muestra más de 10 filas a la vez
const LOCAL_PAGE = 10;

// useLocalPage => paginación en el navegador para listas que llegan completas (Hook reutilizable: DataTable y las tablas
// propias de cada sección). "visible" = filas de la página; "meta"/"setPage" alimentan a TablePager.
export function useLocalPage<T>(rows: readonly T[] | undefined) {
  const [page, setPage] = useState(1);
  const total = rows?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LOCAL_PAGE));
  const current = Math.min(page, totalPages); // La lista pudo encogerse (filtro, recarga)
  const visible = rows?.slice((current - 1) * LOCAL_PAGE, current * LOCAL_PAGE) ?? [];
  return { visible, setPage, meta: { page: current, totalPages, total, limit: LOCAL_PAGE } as PaginationMeta };
}

// TablePager => cantidad de registros y Anterior/Siguiente (los botones solo si hay más de una página)
export function TablePager({ meta, onPage }: { meta: PaginationMeta; onPage: (page: number) => void }) {
  const t = useTranslations("admin.table");
  if (meta.total === 0) return null;
  const pages = meta.totalPages > 1;
  return (
    <nav aria-label={t("pagination")} className={cn("flex items-center gap-2 text-sm", pages ? "justify-between" : "justify-end")}>
      {pages && (
        <Button size="sm" variant="secondary" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
          {t("previous")}
        </Button>
      )}
      <span className="text-center text-slate-600">{t("page", { page: meta.page, total: meta.totalPages, count: meta.total })}</span>
      {pages && (
        <Button size="sm" variant="secondary" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
          {t("next")}
        </Button>
      )}
    </nav>
  );
}

export function DataTable<T>({ caption, columns, rows: allRows, rowKey, loading = false, meta: serverMeta, onPage: serverOnPage, empty, onRowClick }: DataTableProps<T>) {
  const t = useTranslations("admin.table");
  const local = useLocalPage(allRows);
  // Sin "meta" del servidor => se pagina en el navegador con la misma barra de paginación
  const rows = serverMeta ? allRows : allRows && local.visible;
  const meta = serverMeta ?? local.meta;
  const onPage = serverMeta ? serverOnPage : local.setPage;
  if (loading && !allRows) return <Skeleton className="h-48 w-full" />;
  return (
    <div className="flex flex-col gap-3">
      {/* Móvil (< sm): cada fila es un bloque con pares encabezado/valor (data-label), sin scroll horizontal.
          display:block quita la semántica de tabla, por eso los role explícitos la conservan para lectores de pantalla */}
      <div className="overflow-hidden rounded-lg border sm:overflow-x-auto">
        <table role="table" className="w-full text-left text-sm max-sm:block sm:min-w-[640px]" aria-busy={loading || undefined}>
          <caption className="sr-only">{caption}</caption>
          <thead role="rowgroup" className="bg-muted text-xs text-slate-600 max-sm:sr-only">
            <tr role="row">
              {columns.map((column) => (
                <th key={column.key} role="columnheader" scope="col" className={cn("px-3 py-2.5 font-semibold", column.className)}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody role="rowgroup" className="divide-y max-sm:block">
            {rows?.length === 0 && (
              <tr role="row" className="max-sm:block">
                <td role="cell" colSpan={columns.length} className="px-3 py-8 text-center text-slate-500 max-sm:block">
                  {empty ?? t("empty")}
                </td>
              </tr>
            )}
            {rows?.map((row) => (
              <tr
                key={rowKey(row)}
                role="row"
                className={cn("hover:bg-muted/40 max-sm:block max-sm:py-2", onRowClick && "cursor-pointer")}
                // El clic en la fila es un atajo; cada fila también ofrece un botón/enlace accesible por teclado
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    role="cell"
                    data-label={column.header}
                    className={cn(
                      "px-3 py-2.5 align-middle max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-4 max-sm:py-1.5 max-sm:text-right max-sm:before:text-left max-sm:before:text-xs max-sm:before:font-medium max-sm:before:text-slate-500 max-sm:before:content-[attr(data-label)]",
                      column.className
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {onPage && <TablePager meta={meta} onPage={onPage} />}
    </div>
  );
}
