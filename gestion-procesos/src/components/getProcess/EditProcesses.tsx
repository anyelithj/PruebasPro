import { useNavigate, useParams } from 'react-router-dom'
import { useProcesses } from '../../hooks/useProcesses'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import NotFoundNotice from '../accesories/NotFoundNotice'
import Spinner from '../accesories/Spinner'
import ProcessForm from '../uploadProcess/ProcessForm'

export default function EditProcesses() {
  const { id } = useParams()
  const { getById, edit, loading } = useProcesses()
  const navigate = useNavigate()
  const process = getById(id)

  if (loading) return <Spinner />
  if (!process) return <NotFoundNotice what="este proceso" to="/app/procesos" />

  return (
    <>
      <Seo title={`Editar ${process.title}`} noIndex />
      <PageHeader title="Editar proceso" back={{ to: `/app/procesos/${process.id}`, label: process.title }} />
      <div className="form-panel">
        <ProcessForm
          mode="edit"
          initial={{ ...process }}
          currentStatus={process.status}
          submitLabel="Guardar cambios"
          onSubmit={async (input) => {
            await edit(process.id, input)
            navigate(`/app/procesos/${process.id}`)
          }}
        />
      </div>
    </>
  )
}
