import { Button, Form } from 'react-bootstrap'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useProcesses } from '../../hooks/useProcesses'
import { useTasks } from '../../hooks/useTasks'
import { useUsers } from '../../hooks/useUsers'
import { TASK_STATUSES, TASK_STATUS_LABEL, type TaskStatus } from '../../models'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import NotFoundNotice from '../accesories/NotFoundNotice'
import Spinner from '../accesories/Spinner'
import FileManager from '../files/FileManager'
import { formatDate } from '../helpers/ConvertirId'
import { confirmDelete, showError } from '../helpers/confirm'
import HistoryTimeline from '../history/HistoryTimeline'
import TaskForm from './TaskForm'

export default function TaskDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getById, move, remove, loading } = useTasks()
  const { getById: getProcess } = useProcesses()
  const { nameOf } = useUsers()
  const { can } = useAuth()
  const task = getById(id)

  if (loading) return <Spinner />
  if (!task) return <NotFoundNotice what="esta tarea" to="/app/tareas" />
  const process = getProcess(task.processId)

  const handleDelete = async () => {
    if (await confirmDelete('¿Eliminar esta tarea?', 'También se eliminarán sus archivos.')) {
      try {
        await remove(task)
        navigate('/app/tareas')
      } catch (e) {
        showError(e)
      }
    }
  }

  return (
    <>
      <Seo title={task.title} noIndex />
      <PageHeader
        title={task.title}
        subtitle={`Tarea · ${TASK_STATUS_LABEL[task.status]}`}
        back={
          process ? { to: `/app/procesos/${process.id}`, label: process.title } : { to: '/app/tareas', label: 'Tareas' }
        }
        actions={
          <>
            {can('task:edit') && (
              <Form.Select
                size="sm"
                className="w-auto"
                aria-label="Cambiar estado"
                value={task.status}
                onChange={(e) => move(task, e.target.value as TaskStatus).catch(showError)}
              >
                {TASK_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {TASK_STATUS_LABEL[st]}
                  </option>
                ))}
              </Form.Select>
            )}
            {can('task:edit') && (
              <Link to={`/app/tareas/${task.id}/editar`} className="btn btn-outline-primary">
                Editar
              </Link>
            )}
            {can('task:delete') && (
              <Button variant="outline-danger" onClick={handleDelete}>
                Eliminar
              </Button>
            )}
          </>
        }
      />
      <section aria-labelledby="t-datos" className="detail-block">
        <h2 id="t-datos" className="h5">
          Datos
        </h2>
        <TaskForm key={task.updatedAt} mode="view" initial={{ ...task }} />
        <p className="small text-secondary mt-3 mb-0">
          Creada por {task.createdBy === 'system' ? 'una automatización' : nameOf(task.createdBy)}
          {process && (
            <>
              {' '}
              · Proceso: <Link to={`/app/procesos/${process.id}`}>{process.title}</Link>
            </>
          )}
          {task.completedAt ? ` · Completada el ${formatDate(task.completedAt)}` : ''}
        </p>
      </section>
      <section aria-labelledby="t-archivos" className="detail-block">
        <h2 id="t-archivos" className="h5">
          Archivos y documentos
        </h2>
        <FileManager entityType="task" entityId={task.id} entityTitle={task.title} />
      </section>
      <section aria-labelledby="t-historial" className="detail-block">
        <h2 id="t-historial" className="h5">
          Historial de cambios
        </h2>
        <HistoryTimeline entityId={task.id} />
      </section>
    </>
  )
}
