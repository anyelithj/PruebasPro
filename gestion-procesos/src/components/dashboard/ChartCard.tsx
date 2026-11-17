// `import type` (TypeScript): importa solo el tipo, se borra al compilar y no pesa en el bundle.
import type { ReactNode } from 'react'

/** Dato mínimo de una gráfica de categorías: etiqueta + valor numérico. */
export interface Datum {
  label: string
  value: number
}

/** Props comunes a todas las gráficas: un título y, opcionalmente, una nota bajo la gráfica. */
export interface ChartCardProps {
  title: string
  /** `?` (TypeScript): propiedad opcional. */
  note?: string
}

/**
 * Contenedor único de gráficas (patrón Composición / «slot» de React: recibe el contenido en `children`).
 * Todas las gráficas comparten así el mismo relleno, borde, título y estado vacío (DRY).
 * `<figure>` + `<figcaption>` (HTML5 semántico): el título queda asociado a la gráfica para lectores de pantalla.
 */
export default function ChartCard({
  title,
  note,
  empty,
  children,
}: ChartCardProps & { empty: boolean; children: ReactNode }) {
  // `&` (TypeScript): intersección de tipos; une las props públicas con las internas.
  return (
    <figure className="chart-card">
      <figcaption className="chart-card__title">{title}</figcaption>
      {/* Operador ternario (JS): sin datos se muestra un mensaje en vez de una gráfica vacía. */}
      {empty ? <p className="chart-card__empty">Aún no hay datos.</p> : children}
      {/* `&&` (JS): renderizado condicional, solo pinta la nota si existe. */}
      {note && !empty && <p className="chart-card__note">{note}</p>}
    </figure>
  )
}
