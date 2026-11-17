import { useNavigate, useParams } from 'react-router-dom'
import { useWorkflow } from '../../hooks/useWorkflow'
import NotFoundNotice from '../accesories/NotFoundNotice'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import WorkflowForm from './WorkflowForm'

/** Crea o edita un flujo (según haya `:id` en la ruta). */
export default function WorkflowEditor() {
  const { id } = useParams()
  const { workflows, add, edit } = useWorkflow()
  const navigate = useNavigate()
  const current = workflows.find((w) => w.id === id)

  if (id && (!current || current.id === 'default')) {
    return <NotFoundNotice what="este flujo, o no se puede editar" to="/app/workflows" label="Volver" />
  }

  const title = id ? 'Editar flujo' : 'Nuevo flujo'
  return (
    <>
      <Seo title={title} noIndex />
      <PageHeader title={title} back={{ to: '/app/workflows', label: 'Workflows' }} />
      <div className="form-panel">
        <WorkflowForm
          mode={id ? 'edit' : 'create'}
          initial={current ? { name: current.name, states: current.states.join(', ') } : undefined}
          onSubmit={async (name, states) => {
            const target = id ? (await edit(id, name, states), id) : await add(name, states)
            navigate(`/app/workflows/${target}`)
          }}
        />
      </div>
    </>
  )
}
