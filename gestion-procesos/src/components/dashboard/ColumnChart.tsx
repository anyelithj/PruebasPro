import ChartCard, { type ChartCardProps, type Datum } from './ChartCard'

// `const` (JS): constantes de módulo; medidas del lienzo SVG en unidades del viewBox (escalan con el ancho).
const W = 320
const H = 160
const PAD = { top: 18, bottom: 22 }

/**
 * Columnas verticales («torres») en SVG puro: para series ordenadas y cortas (días, rangos de edad).
 * Patrón Presentational Component: solo dibuja lo que recibe, sin estado ni acceso a datos.
 */
export default function ColumnChart({ title, note, data }: ChartCardProps & { data: Datum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const ih = H - PAD.top - PAD.bottom // alto útil del área de dibujo
  const slot = W / Math.max(1, data.length) // ancho reservado para cada columna
  const bw = Math.min(36, slot * 0.6) // ancho de la columna: fino, con aire entre columnas
  // Resumen textual para lectores de pantalla (accesibilidad): «Lun 3, Mar 5, …».
  const summary = data.map((d) => `${d.label} ${d.value}`).join(', ')

  return (
    <ChartCard title={title} note={note} empty={data.every((d) => d.value === 0)}>
      {/* `role="img"` + `aria-label` (WAI-ARIA): el SVG se anuncia como una imagen con su descripción. */}
      <svg className="column-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${summary}`}>
        <line className="column-chart__base" x1={0} x2={W} y1={PAD.top + ih} y2={PAD.top + ih} />
        {data.map((d, i) => {
          const h = (d.value / max) * ih
          const x = i * slot + (slot - bw) / 2
          const base = PAD.top + ih // línea del eje
          const y = base - h
          const r = Math.min(4, h, bw / 2) // radio de la esquina (4px como máximo)
          return (
            <g key={d.label}>
              {/* `<title>` (SVG): tooltip nativo del navegador al pasar el ratón. */}
              <title>{`${d.label}: ${d.value}`}</title>
              {/* Columna con esquinas superiores redondeadas (path) y base recta sobre el eje. */}
              {h > 0 && (
                <path
                  className="column-chart__bar"
                  d={`M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${base} Z`}
                />
              )}
              <text className="column-chart__value" x={x + bw / 2} y={y - 5} textAnchor="middle">
                {d.value}
              </text>
              <text className="column-chart__label" x={x + bw / 2} y={H - 6} textAnchor="middle">
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </ChartCard>
  )
}
