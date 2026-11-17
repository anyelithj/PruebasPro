import ChartCard, { type ChartCardProps, type Datum } from './ChartCard'

// `interface ... extends` (TypeScript): hereda las props comunes de ChartCard y añade las propias.
interface Props extends ChartCardProps {
  data: Datum[]
  /** Sufijo del valor, p. ej. «%» o « d». */
  unit?: string
  /** Escala fija (p. ej. 100 para porcentajes). */
  max?: number
}

/**
 * Barras horizontales hechas con CSS (sin librerías): ideal para comparar categorías con nombres largos.
 * Accesible: cada valor aparece como texto, no solo como longitud de barra.
 */
export default function BarChart({ title, note, data, unit = '', max: fixedMax }: Props) {
  // `??` (JS): usa la escala fija si llega; si no, el mayor valor (mínimo 1 para no dividir entre 0).
  const max = fixedMax ?? Math.max(1, ...data.map((d) => d.value))
  return (
    <ChartCard title={title} note={note} empty={data.length === 0}>
      <ul className="bar-chart">
        {/* `.map` (JS, paradigma declarativo/funcional): una fila por dato. `key` (React) identifica cada fila. */}
        {data.map((d) => (
          <li key={d.label}>
            <span className="bar-chart__label" title={d.label}>
              {d.label}
            </span>
            {/* `aria-hidden` (WAI-ARIA): la barra es decorativa; el valor ya se lee como texto. */}
            <span className="bar-chart__track" aria-hidden="true">
              <span className="bar-chart__bar" style={{ width: `${(d.value / max) * 100}%` }} />
            </span>
            <span className="bar-chart__value">
              {d.value}
              {unit}
            </span>
          </li>
        ))}
      </ul>
    </ChartCard>
  )
}
