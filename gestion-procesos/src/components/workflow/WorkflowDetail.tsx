import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useProcesses } from '../../hooks/useProcesses'
import { useWorkflow } from '../../hooks/useWorkflow'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import NotFoundNotice from '../accesories/NotFoundNotice'
import WorkflowForm from './WorkflowForm'

export default function WorkflowDetail() {
  const { id } = useParams()
  const { workflows } = useWorkflow()
  const { can } = useAuth()
  const { processes } = useProcesses()
  const wf = workflows.find((w) => w.id === id)
  if (!wf) return <NotFoundNotice what="este flujo" to="/app/workflows" label="Volver" />
  const own = processes.filter((p) => p.workflowId === wf.id)
  return (
    <>
      <Seo title={wf.name} noIndex />
      <PageHeader
        title={wf.name}
        back={{ to: '/app/workflows', label: 'Workflows' }}
        actions={
          wf.id !== 'default' &&
          can('workflow:manage') && (
            <Link to={`/app/workflows/${wf.id}/editar`} className="btn btn-outline-primary">
              Editar
            </Link>
          )
        }
      />
      <section className="detail-block" aria-labelledby="wf-estados">
        <h2 id="wf-estados" className="h5">
          Estados
        </h2>
        <WorkflowForm key={wf.states.join()} mode="view" initial={{ name: wf.name, states: wf.states.join(', ') }} />
        <ul className="mt-3 mb-0">
          {wf.states.map((s) => (
            <li key={s}>
              {s}: {own.filter((p) => p.status === s).length} proceso(s)
            </li>
          ))}
        </ul>
      </section>
      <section className="detail-block" aria-labelledby="wf-procesos">
        <h2 id="wf-procesos" className="h5">
          Procesos que usan este flujo ({own.length})
        </h2>
        {own.length === 0 ? (
          <p className="text-secondary mb-0">Ninguno todavía.</p>
        ) : (
          <ul className="mb-0">
            {own.map((p) => (
              <li key={p.id}>
                <Link to={`/app/procesos/${p.id}`}>{p.title}</Link> — {p.status}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
