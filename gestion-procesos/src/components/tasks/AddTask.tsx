import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTasks } from '../../hooks/useTasks'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import TaskForm, { emptyTask } from './TaskForm'

export default function AddTask() {
  const { add } = useTasks()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initial = { ...emptyTask, dueDate: params.get('fecha') ?? '', processId: params.get('proceso') ?? '' }
  return (
    <>
      <Seo title="Nueva tarea" noIndex />
      <PageHeader title="Nueva tarea" back={{ to: '/app/tareas', label: 'Tareas' }} />
      <div className="form-panel">
        <TaskForm
          mode="create"
          initial={initial}
          submitLabel="Crear tarea"
          onSubmit={async (input) => {
            const id = await add(input)
            navigate(`/app/tareas/${id}`)
          }}
        />
      </div>
    </>
  )
}
