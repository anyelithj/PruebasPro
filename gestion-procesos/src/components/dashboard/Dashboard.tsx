import { Badge, Form } from 'react-bootstrap'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDashboard } from '../../hooks/useDashboard'
import { PRIORITY_LABEL, TASK_STATUS_LABEL } from '../../models'
import '../../styles/StyleDashboard.scss'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import BarChart from './BarChart'

const pct = (v: number | null) => (v === null ? '—' : `${v}%`)

/** Indicadores de procesos y tareas, calculados con el flujo (workflow) de cada proceso. */
export default function Dashboard() {
  const d = useDashboard()
  const [wfId, setWfId] = useState('')
  const wf = d.byWorkflow.find((w) => w.workflowId === wfId) ?? d.byWorkflow[0]
  const trendMax = Math.max(1, ...d.trend.flatMap((t) => [t.created, t.finished]))

  return (
    <>
      <Seo title="Indicadores" noIndex />
      <PageHeader
        title="Indicadores"
        subtitle="Estado de procesos y tareas según su flujo de trabajo."
        actions={
          <Link to="/app/reportes" className="btn btn-outline-primary">
            Ver reportes
          </Link>
        }
      />

      <h2 className="h5">Procesos</h2>
      <dl className="summary">
        <div>
          <dt>Total</dt>
          <dd>{d.totalProcesses}</dd>
        </div>
        <div>
          <dt>Activos</dt>
          <dd>{d.activeProcesses}</dd>
        </div>
        <div>
          <dt>Finalizados</dt>
          <dd>{d.finishedProcesses}</dd>
        </div>
        <div className={d.overdueProcesses ? 'is-alert' : undefined}>
          <dt>Vencidos</dt>
          <dd>{d.overdueProcesses}</dd>
        </div>
        <div>
          <dt>Cumplimiento de fechas</dt>
          <dd>{pct(d.onTimeRate)}</dd>
        </div>
        <div>
          <dt>Días promedio de cierre</dt>
          <dd>{d.avgCycleDays ?? '—'}</dd>
        </div>
      </dl>

      <h2 className="h5 mt-4">Tareas</h2>
      <dl className="summary">
        <div>
          <dt>Total</dt>
          <dd>{d.totalTasks}</dd>
        </div>
        <div>
          <dt>Abiertas</dt>
          <dd>{d.openTasks}</dd>
        </div>
        <div>
          <dt>Hechas</dt>
          <dd>{d.doneTasks}</dd>
        </div>
        <div className={d.overdueTasks ? 'is-alert' : undefined}>
          <dt>Vencidas</dt>
          <dd>{d.overdueTasks}</dd>
        </div>
        <div>
          <dt>Completadas</dt>
          <dd>{d.taskCompletionRate}%</dd>
        </div>
      </dl>

      <div className="l-grid">
        <div>
          {d.byWorkflow.length > 1 && (
            <Form.Group controlId="dash-wf" className="mb-2">
              <Form.Label className="small">Flujo</Form.Label>
              <Form.Select size="sm" value={wf?.workflowId ?? ''} onChange={(e) => setWfId(e.target.value)}>
                {d.byWorkflow.map((w) => (
                  <option key={w.workflowId} value={w.workflowId}>
                    {w.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          )}
          <BarChart
            title={`Procesos por estado del flujo${wf ? `: ${wf.name}` : ''}`}
            data={(wf?.states ?? []).map((s) => ({ label: s.state, value: s.count }))}
          />
        </div>
        <BarChart
          title="Procesos por prioridad"
          data={d.byPriority.map((x) => ({ label: PRIORITY_LABEL[x.priority], value: x.value }))}
        />
        <BarChart
          title="Tareas por estado"
          data={d.tasksByStatus.map((x) => ({ label: TASK_STATUS_LABEL[x.status], value: x.value }))}
        />
        <BarChart
          title="Carga de trabajo (tareas abiertas)"
          data={d.workload.map((w) => ({ label: w.name, value: w.open }))}
        />
      </div>

      <section aria-labelledby="tendencia" className="detail-block mt-4">
        <h2 id="tendencia" className="h6">
          Procesos creados y finalizados (últimos 6 meses)
        </h2>
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <caption className="visually-hidden">Tendencia mensual</caption>
            <thead>
              <tr>
                <th scope="col">Mes</th>
                <th scope="col">Creados</th>
                <th scope="col">Finalizados</th>
              </tr>
            </thead>
            <tbody>
              {d.trend.map((t) => (
                <tr key={t.label}>
                  <th scope="row">{t.label}</th>
                  <td>
                    <span
                      className="trend-bar trend-bar--a"
                      style={{ width: `${(t.created / trendMax) * 8}rem` }}
                      aria-hidden="true"
                    />{' '}
                    {t.created}
                  </td>
                  <td>
                    <span
                      className="trend-bar trend-bar--b"
                      style={{ width: `${(t.finished / trendMax) * 8}rem` }}
                      aria-hidden="true"
                    />{' '}
                    {t.finished}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="avance" className="detail-block">
        <h2 id="avance" className="h6">
          Avance de cada proceso (flujo + tareas)
        </h2>
        {d.progress.length === 0 ? (
          <p className="text-secondary mb-0">Aún no hay procesos.</p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <caption className="visually-hidden">Avance por proceso</caption>
              <thead>
                <tr>
                  <th scope="col">Proceso</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Flujo</th>
                  <th scope="col">Tareas</th>
                  <th scope="col">Avance</th>
                </tr>
              </thead>
              <tbody>
                {d.progress.slice(0, 20).map((p) => (
                  <tr key={p.processId}>
                    <td>
                      <Link to={`/app/procesos/${p.processId}`}>{p.title}</Link>{' '}
                      {p.overdue && <Badge bg="danger">Vencido</Badge>}
                    </td>
                    <td>{p.status}</td>
                    <td>{p.workflowPct}%</td>
                    <td>{p.tasksTotal ? `${p.tasksDone}/${p.tasksTotal}` : '—'}</td>
                    <td style={{ minWidth: '8rem' }}>
                      <div
                        className="progress"
                        role="progressbar"
                        aria-label={`Avance de ${p.title}`}
                        aria-valuenow={p.progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className={`progress-bar${p.finished ? ' bg-success' : ''}`}
                          style={{ width: `${p.progress}%` }}
                        >
                          {p.progress}%
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
