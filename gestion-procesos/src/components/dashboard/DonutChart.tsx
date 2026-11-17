import ChartCard, { type ChartCardProps, type Datum } from './ChartCard'

// Paleta categórica validada (contraste y daltonismo). Orden fijo: el color sigue a la categoría, nunca a su rango.
const COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100']
const R = 42 // radio del anillo en unidades del viewBox (0–100)
const C = 2 * Math.PI * R // circunferencia: base para repartir el anillo con stroke-dasharray

/**
 * Dona en SVG puro: reparto de un total en pocas partes (≤ 4).
 * Cada segmento es un `<circle>` cuyo trazo se recorta con `stroke-dasharray` (técnica CSS/SVG, sin librerías).
 * La leyenda muestra nombre, cantidad y % para no depender solo del color (accesibilidad).
 */
export default function DonutChart({ title, note, data }: ChartCardProps & { data: Datum[] }) {
  // `reduce` (JS, programación funcional): suma de todos los valores.
  const total = data.reduce((a, d) => a + d.value, 0)
  let offset = 0 // `let` (JS): variable reasignable; acumula dónde empieza cada segmento.

  return (
    <ChartCard title={title} note={note} empty={total === 0}>
      <div className="donut-chart">
        <svg viewBox="0 0 100 100" className="donut-chart__svg" aria-hidden="true">
          {/* Pista gris de fondo: el anillo completo. */}
          <circle cx="50" cy="50" r={R} className="donut-chart__track" />
          {data.map((d, i) => {
            const len = (d.value / total) * C
            // Separación de 2 unidades entre segmentos para distinguirlos sin depender del color.
            const gap = data.filter((x) => x.value > 0).length > 1 ? Math.min(2, len) : 0
            const seg = (
              <circle
                key={d.label}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={COLORS[i % COLORS.length]}
                strokeWidth="12"
                strokeDasharray={`${Math.max(0, len - gap)} ${C}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 50 50)" // empieza a las 12 en punto
              >
                <title>{`${d.label}: ${d.value}`}</title>
              </circle>
            )
            offset += len
            return d.value > 0 ? seg : null
          })}
          <text x="50" y="48" textAnchor="middle" className="donut-chart__total">
            {total}
          </text>
          <text x="50" y="62" textAnchor="middle" className="donut-chart__caption">
            total
          </text>
        </svg>
        {/* `<ul>` semántica para la leyenda: es una lista de categorías con su valor. */}
        <ul className="donut-chart__legend">
          {data.map((d, i) => (
            <li key={d.label}>
              <span className="donut-chart__swatch" style={{ background: COLORS[i % COLORS.length] }} aria-hidden="true" />
              <span className="donut-chart__name">{d.label}</span>
              <span className="donut-chart__value">
                {d.value} <small>({Math.round((d.value / total) * 100)}%)</small>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  )
}
