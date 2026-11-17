import { useSearchParams, useNavigate } from 'react-router-dom'
import { useProcesses } from '../../hooks/useProcesses'
import '../../styles/StyleAddProcess.scss'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import ProcessForm, { emptyProcess } from './ProcessForm'

export default function AddProcess() {
  const { add } = useProcesses()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const date = params.get('fecha') ?? ''
  return (
    <>
      <Seo title="Nuevo proceso" noIndex />
      <PageHeader
        title="Nuevo proceso"
        subtitle="Registra un proceso o una solicitud y asígnalo a su responsable."
        back={{ to: '/app/procesos', label: 'Procesos' }}
      />
      <div className="form-panel">
        <ProcessForm
          mode="create"
          initial={{ ...emptyProcess, dueDate: date }}
          submitLabel="Crear proceso"
          onSubmit={async (input) => {
            const id = await add(input)
            navigate(`/app/procesos/${id}`)
          }}
        />
      </div>
    </>
  )
}
