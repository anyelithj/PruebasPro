import { Button } from 'react-bootstrap'
import { FiPlus } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useWorkflow } from '../../hooks/useWorkflow'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import { confirmDelete, showError } from '../helpers/confirm'

export default function WorkflowManager() {
  const { workflows, processCount, remove } = useWorkflow()
  // Ver los flujos es para todos; crear, editar y eliminar solo con el permiso de gestión.
  const { can } = useAuth()
  const canManage = can('workflow:manage')
  return (
    <>
      <Seo title="Workflows" noIndex />
      <PageHeader
        title="Workflows"
        subtitle="Estados por los que pasa un proceso. El último estado es el final."
        actions={
          canManage && (
            <Link to="/app/workflows/nuevo" className="btn btn-primary">
              <FiPlus aria-hidden="true" /> Nuevo flujo
            </Link>
          )
        }
      />
      <ul className="row-list mt-0">
        {workflows.map((w) => (
          <li key={w.id} className="row-list__item">
            <div>
              <Link to={`/app/workflows/${w.id}`} className="fw-bold">
                {w.name}
              </Link>
              <div className="small text-secondary">
                {w.states.join(' → ')} · {processCount(w.id)} proceso(s)
              </div>
            </div>
            <div className="row-list__actions">
              <Link to={`/app/workflows/${w.id}`} className="btn btn-sm btn-outline-primary">
                Ver
              </Link>
              {canManage && w.id !== 'default' && (
                <>
                  <Link to={`/app/workflows/${w.id}/editar`} className="btn btn-sm btn-outline-secondary">
                    Editar
                  </Link>
                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={async () => {
                      if (await confirmDelete(`¿Eliminar el flujo «${w.name}»?`)) await remove(w.id).catch(showError)
                    }}
                  >
                    Eliminar
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
