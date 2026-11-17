import { useNavigate, useParams } from 'react-router-dom'
import { useTasks } from '../../hooks/useTasks'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import NotFoundNotice from '../accesories/NotFoundNotice'
import Spinner from '../accesories/Spinner'
import TaskForm from './TaskForm'

export default function EditTask() {
  const { id } = useParams()
  const { getById, edit, loading } = useTasks()
  const navigate = useNavigate()
  const task = getById(id)
  if (loading) return <Spinner />
  if (!task) return <NotFoundNotice what="esta tarea" to="/app/tareas" />
  return (
    <>
      <Seo title={`Editar ${task.title}`} noIndex />
      <PageHeader title="Editar tarea" back={{ to: `/app/tareas/${task.id}`, label: task.title }} />
      <div className="form-panel">
        <TaskForm
          mode="edit"
          initial={{ ...task }}
          submitLabel="Guardar cambios"
          onSubmit={async (input) => {
            await edit(task, input)
            navigate(`/app/tareas/${task.id}`)
          }}
        />
      </div>
    </>
  )
}
