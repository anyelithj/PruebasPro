// `import` (ES Modules): cada dependencia se declara explícitamente; Vite separa esta página en su propio chunk (lazy).
import { Link } from 'react-router-dom' // React Router: navegación SPA sin recargar la página
import { PRIORITY_LABEL } from '../../models'
import { useAppSelector } from '../../hooks/useRedux' // hook tipado de Redux Toolkit
import { selectAnalytics } from '../../redux/selectors/selectors' // selector memoizado (Reselect): solo recalcula si cambian los datos
import '../../styles/StyleDashboard.scss'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import BarChart from './BarChart'
import ColumnChart from './ColumnChart'
import DonutChart from './DonutChart'
import TrendChart from './TrendChart'

/**
 * Página «Analítica» (React, componente funcional).
 * Arquitectura: la lógica vive en `services/analytics.ts` (función pura), el selector la conecta al estado
 * y este componente solo presenta (patrón Container/Presentational + separación de responsabilidades, SRP).
 * No repite las cifras de «Indicadores»: aquí se mira el comportamiento en el tiempo.
 */
export default function Analytics() {
  // `const` (JS): referencia inmutable. `useAppSelector` lee el resultado ya calculado del store.
  const a = useAppSelector(selectAnalytics)
  const i = a.insights // alias corto para los datos generales

  return (
    // `<>` (Fragment de React): agrupa sin añadir un nodo extra al DOM.
    <>
      {/* SEO: título de la pestaña; `noIndex` porque es un área privada. */}
      <Seo title="Analítica" noIndex />
      <PageHeader
        title="Analítica"
        subtitle="Ritmo del equipo, antigüedad del trabajo, plazos y cumplimiento."
        actions={
          <Link to="/app/dashboard" className="btn btn-outline-primary">
            Ver indicadores
          </Link>
        }
      />

      {/* `<section>` + `aria-labelledby` (HTML semántico + ARIA): cada bloque queda nombrado por su título. */}
      <section aria-labelledby="general">
        <h2 id="general" className="h5">
          Información general
        </h2>
        {/* `<dl>` (lista de descripción): pares término/valor, la etiqueta correcta para datos clave. */}
        <dl className="summary summary--compact">
          <div>
            <dt>Tareas completadas por semana</dt>
            <dd>{i.avgWeeklyDone}</dd>
          </div>
          <div>
            <dt>Día más productivo</dt>
            {/* `??` (JS, nullish coalescing): muestra «—» si aún no hay datos. */}
            <dd>{i.bestWeekday ?? '—'}</dd>
          </div>
          <div>
            <dt>Prioridad que más tarda en cerrar</dt>
            <dd>{i.slowestPriority ? `${PRIORITY_LABEL[i.slowestPriority.priority]} · ${i.slowestPriority.days} d` : '—'}</dd>
          </div>
          <div>
            <dt>Mejor cumplimiento</dt>
            <dd>{i.topPerson ? `${i.topPerson.name} · ${i.topPerson.pct}%` : '—'}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="graficas" className="mt-4">
        <h2 id="graficas" className="h5">
          Gráficas
        </h2>

        {/* Líneas: ritmo semanal. La tabla va dentro de la misma tarjeta (accesibilidad: datos sin depender del gráfico). */}
        <TrendChart
          title="Tareas creadas y completadas por semana (últimas 8)"
          data={a.weekly}
          names={['Creadas', 'Completadas']}
        >
          {/* `<details>/<summary>` (HTML nativo): desplegable sin JavaScript. */}
          <details>
            <summary>Ver como tabla</summary>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0 mt-2">
                <caption className="visually-hidden">Ritmo semanal de tareas</caption>
                <thead>
                  <tr>
                    <th scope="col">Semana del</th>
                    <th scope="col">Creadas</th>
                    <th scope="col">Completadas</th>
                  </tr>
                </thead>
                <tbody>
                  {a.weekly.map((w) => (
                    <tr key={w.label}>
                      <th scope="row">{w.label}</th>
                      <td>{w.created}</td>
                      <td>{w.finished}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </TrendChart>

        {/* Rejilla adaptable: cada tarjeta mide lo que su contenido (sin huecos verticales). */}
        <div className="l-grid">
          {/* Columnas («torres»): series ordenadas y cortas. */}
          <ColumnChart title="Tareas completadas por día" data={a.byWeekday} />
          <ColumnChart title="Antigüedad de procesos abiertos" data={a.aging} />
          {/* Dona: reparto de un total en pocas partes. */}
          <DonutChart
            title="Próximos vencimientos"
            data={a.upcoming}
            note="Procesos y tareas abiertos; lo ya vencido está en Indicadores."
          />
          <DonutChart title="Procesos y solicitudes" data={a.byKind} />
          {/* Barras horizontales: categorías con nombres largos. */}
          <BarChart
            title="Días promedio de cierre por prioridad"
            data={a.cycleByPriority.map((x) => ({ label: PRIORITY_LABEL[x.priority], value: x.days }))}
            unit=" d"
          />
          <BarChart
            title="Tareas a tiempo por persona"
            data={a.onTimeByPerson.map((x) => ({ label: x.name, value: x.pct }))}
            unit="%"
            max={100}
          />
          <BarChart title="Procesos por categoría" data={a.byCategory} />
        </div>
      </section>
    </>
  )
}
