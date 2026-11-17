// `useState` (hook de React): guarda qué punto está bajo el ratón para dibujar la guía y el tooltip.
import { useState, type ReactNode } from 'react'
import ChartCard, { type ChartCardProps } from './ChartCard'

interface Point {
  label: string
  created: number
  finished: number
}

// `as const` (TypeScript): fija los literales para que `d[s.key]` quede tipado como número.
const KEYS = ['created', 'finished'] as const
const COLORS = ['#2a78d6', '#eb6834'] // par categórico validado (contraste y daltonismo)

// Lienzo en unidades del viewBox; el SVG escala al ancho del contenedor (responsive).
const W = 600
const H = 220
const PAD = { top: 16, right: 96, bottom: 28, left: 32 }

/** Dos series en el tiempo (líneas), en SVG puro y con tooltip al pasar el ratón. */
export default function TrendChart({
  title,
  note,
  data,
  names = ['Creados', 'Finalizados'],
  children,
}: ChartCardProps & {
  data: Point[]
  /** Nombres de las dos series, en el orden created/finished. */
  names?: [string, string]
  /** Contenido extra dentro de la tarjeta (p. ej. la vista en tabla). */
  children?: ReactNode
}) {
  const SERIES = KEYS.map((key, i) => ({ key, name: names[i], color: COLORS[i] }))
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.flatMap((d) => [d.created, d.finished]))
  const top = Math.ceil(max / 2) * 2 // eje en números pares para que la marca media sea entera
  const iw = W - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (data.length > 1 ? (i / (data.length - 1)) * iw : iw / 2)
  const y = (v: number) => PAD.top + ih - (v / top) * ih
  const last = data.length - 1

  // Etiquetas directas al final de cada línea; si se pisan, se separan.
  const endY = SERIES.map((s) => (last >= 0 ? y(data[last][s.key]) : 0))
  if (Math.abs(endY[0] - endY[1]) < 14) {
    const mid = (endY[0] + endY[1]) / 2
    const up = data[last]?.created >= data[last]?.finished ? 0 : 1
    endY[up] = mid - 7
    endY[1 - up] = mid + 7
  }

  return (
    // Composición: reutiliza la tarjeta común (mismo relleno, título y estado vacío que el resto de gráficas).
    <ChartCard title={title} note={note} empty={data.every((d) => d.created + d.finished === 0)}>
      {data.length > 0 && (
        <>
          <ul className="trend-chart__legend" aria-hidden="true">
            {SERIES.map((s) => (
              <li key={s.key}>
                <span style={{ background: s.color }} /> {s.name}
              </li>
            ))}
          </ul>
          <div className="trend-chart__plot">
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. Detalle en la tabla de abajo.`}>
              {[0, top / 2, top].map((t) => (
                <g key={t} className="trend-chart__grid">
                  <line x1={PAD.left} x2={PAD.left + iw} y1={y(t)} y2={y(t)} />
                  <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                    {t}
                  </text>
                </g>
              ))}
              {data.map((d, i) => (
                <text key={d.label} className="trend-chart__axis" x={x(i)} y={H - 8} textAnchor="middle">
                  {d.label}
                </text>
              ))}
              {hover !== null && <line className="trend-chart__cross" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} />}
              {SERIES.map((s, si) => (
                <g key={s.key}>
                  <polyline
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    points={data.map((d, i) => `${x(i)},${y(d[s.key])}`).join(' ')}
                  />
                  {data.map((d, i) => (
                    <circle
                      key={d.label}
                      cx={x(i)}
                      cy={y(d[s.key])}
                      r={hover === i ? 5 : 4}
                      fill={s.color}
                      stroke="var(--surface)"
                      strokeWidth={2}
                    />
                  ))}
                  <text className="trend-chart__end" x={x(last) + 10} y={endY[si]} dy="0.32em">
                    {s.name}
                  </text>
                </g>
              ))}
              {data.map((d, i) => (
                <rect
                  key={d.label}
                  x={x(i) - iw / Math.max(1, data.length - 1) / 2}
                  y={PAD.top}
                  width={iw / Math.max(1, data.length - 1)}
                  height={ih}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              ))}
            </svg>
            {hover !== null && (
              <div
                className="trend-chart__tip"
                style={{ left: `${(x(hover) / W) * 100}%`, top: `${(PAD.top / H) * 100}%` }}
                role="status"
              >
                <strong>{data[hover].label}</strong>
                {SERIES.map((s) => (
                  <span key={s.key}>
                    <i style={{ background: s.color }} /> {s.name}: <b>{data[hover][s.key]}</b>
                  </span>
                ))}
              </div>
            )}
          </div>
          {children}
        </>
      )}
    </ChartCard>
  )
}
