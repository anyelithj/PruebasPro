// ResourceDetail.tsx (Client Component · React + TanStack Query) => "Ver detalle" GENÉRICO de cualquier fila del panel.
// Lee la definición del módulo en el registro (lib/resources.ts: campos del detalle + sub-tablas como ítems, historial,
// variantes) y pide el registro completo a Express (GET <api>/<id>). Mientras llega (o si el módulo no tiene GET por
// id) muestra los datos de la fila que ya están en pantalla: el diálogo abre al instante y nunca queda vacío.
// Patrones: Registry (findResource), Strategy (CellValue dibuja cada tipo de dato), Null Object (sin definición =>
// se usan las columnas del listado). Accesibilidad: <dl> para pares campo/valor y <table> con <caption> por sección.
// UX: cada valor se dibuja con la MISMA caja que un campo de formulario en solo lectura (borde, alto 44 px, fondo
// atenuado): ver detalle, crear y editar se ven iguales. "exclude" omite los campos que ya muestra el formulario.
"use client"; // Directiva de Next.js: hooks de datos y de traducción => se ejecuta en el navegador

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useAdminGet } from "../api/dashboard.api";
import { findResource, get, type ColumnDef, type Row } from "../lib/resources";
import { CellValue, fieldOf } from "./Cells";
import type { Column } from "./DataTable";

// Props: "resource" = clave del registro; "row" = fila del listado; "columns" = respaldo si el módulo no está registrado
interface ResourceDetailProps<T> {
  resource: string;
  row: T;
  columns: Column<T>[];
  exclude?: string[]; // Campos ya visibles en el formulario de solo lectura (no se repiten)
}

// humanize => "createdAt" -> "Created at" (respaldo legible si falta la traducción de un campo)
const humanize = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());

export function ResourceDetail<T>({ resource, row, columns, exclude = [] }: ResourceDetailProps<T>) {
  const tFields = useTranslations("admin.fields");
  const tSections = useTranslations("admin.sections");
  const def = findResource(resource);
  const data = row as unknown as Row; // "as unknown as" => la fila del backend se trata como registro JSON genérico
  const id = String(get(data, def?.idKey ?? "id") ?? "");
  // detailApi: función => URL propia; null => el módulo no tiene GET por id; undefined => convención "<api>/<id>"
  const path = !def || def.detailApi === null || !id ? null : def.detailApi ? def.detailApi(id) : `${def.api}/${encodeURIComponent(id)}`;
  const detail = useAdminGet<Row>(resource, path); // Misma caché ["admin", resource]: se invalida al editar
  const full: Row = { ...data, ...(detail.data ?? {}) }; // El detalle completo pisa a la fila (más campos, sub-tablas)
  const label = (column: ColumnDef) => (tFields.has(fieldOf(column)) ? tFields(fieldOf(column)) : humanize(fieldOf(column)));

  // Null Object: módulo sin registro => pares encabezado/celda de las columnas del listado (nunca un diálogo vacío)
  const skip = new Set(exclude); // "Set" => búsqueda O(1) por nombre de campo
  const pairs: Array<{ key: string; label: string; value: ReactNode }> = (
    def
      ? (def.detail ?? def.columns).map((column) => ({ key: column.key, label: label(column), value: <CellValue column={column} row={full} /> }))
      : columns.filter((column) => column.key !== "__actions").map((column) => ({ key: column.key, label: column.header, value: column.cell(row) }))
  ).filter((pair) => !skip.has(pair.key));

  return (
    <div className="flex flex-col gap-6" aria-busy={detail.isFetching || undefined}>
      {/* <dl> => lista de descripción: lectores de pantalla anuncian "término / definición" (WCAG 1.3.1) */}
      {/* Misma grilla (gap-4, 2 columnas) y misma caja que ResourceForm en solo lectura: el usuario ve UN formulario */}
      {pairs.length > 0 && (
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {pairs.map((pair) => (
            <div key={pair.key} className="flex min-w-0 flex-col gap-1.5">
              <dt className="text-sm font-medium leading-none text-foreground">{pair.label}</dt>
              <dd className="flex min-h-9 items-center break-words rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-slate-900">{pair.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Sub-tablas (ítems del pedido, historial de estados, variantes...): solo si el registro trae filas */}
      {def?.sections?.map((section) => {
        const rows = get(full, section.key);
        if (!Array.isArray(rows) || rows.length === 0) return null;
        return (
          <div key={section.key} className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[480px] text-left text-sm">
              <caption className="border-b bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-900">{tSections.has(section.key) ? tSections(section.key) : humanize(section.key)}</caption>
              <thead className="text-xs uppercase text-slate-600">
                <tr>
                  {section.columns.map((column) => (
                    <th key={column.key} scope="col" className="px-3 py-2 font-semibold">
                      {label(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {(rows as Row[]).map((item, index) => (
                  <tr key={String(item["id"] ?? index)}>
                    {section.columns.map((column) => (
                      <td key={column.key} className="px-3 py-2 align-middle">
                        <CellValue column={column} row={item} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
