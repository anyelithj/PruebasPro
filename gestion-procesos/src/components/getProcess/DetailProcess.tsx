import { useState } from 'react'
import { Alert, Badge, Button } from 'react-bootstrap'
import { FiMessageSquare } from 'react-icons/fi'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useChat } from '../../hooks/useChat'
import { useDashboard } from '../../hooks/useDashboard'
import { useProcesses } from '../../hooks/useProcesses'
import { useUsers } from '../../hooks/useUsers'
import { useWorkflow } from '../../hooks/useWorkflow'
import '../../styles/StyleDetailProcess.scss'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import NotFoundNotice from '../accesories/NotFoundNotice'
import Spinner from '../accesories/Spinner'
import AIAssistant from '../ai/AIAssistant'
import FileManager from '../files/FileManager'
import { confirmDelete, showError } from '../helpers/confirm'
import HistoryTimeline from '../history/HistoryTimeline'
import TaskList from '../tasks/TaskList'
import ProcessForm from '../uploadProcess/ProcessForm'
import WorkflowStepper from '../workflow/WorkflowStepper'

export default function DetailProcess() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getById, move, remove, loading } = useProcesses()
  const { getWorkflow } = useWorkflow()
  const { nameOf } = useUsers()
  const { can } = useAuth()
  const { progress } = useDashboard()
  const { openProcessChannel } = useChat()
  const [moveError, setMoveError] = useState<string | null>(null)
  const process = getById(id)

  if (loading) return <Spinner />
  if (!process) return <NotFoundNotice what="este proceso" to="/app/procesos" />

  const workflow = getWorkflow(process.workflowId)
  const info = progress.find((p) => p.processId === process.id)

  const handleDelete = async () => {
    if (
      await confirmDelete(
        '¿Eliminar este proceso?',
        'También se eliminarán sus tareas y archivos. No se puede deshacer.',
      )
    ) {
      try {
        await remove(process.id)
        navigate('/app/procesos')
      } catch (e) {
        showError(e)
      }
    }
  }

  return (
    <>
      <Seo title={process.title} noIndex />
      <PageHeader
        title={process.title}
        subtitle={process.kind === 'solicitud' ? 'Solicitud' : 'Proceso'}
        back={{ to: '/app/procesos', label: 'Procesos' }}
        actions={
          <>
            <Button
              variant="outline-primary"
              onClick={async () => navigate(`/app/chat/${await openProcessChannel(process)}`)}
            >
              <FiMessageSquare aria-hidden="true" /> Chat de atención
            </Button>
            {can('process:edit') && (
              <Link to={`/app/procesos/${process.id}/editar`} className="btn btn-outline-primary">
                Editar
              </Link>
            )}
            {can('process:delete') && (
              <Button variant="outline-danger" onClick={handleDelete}>
                Eliminar
              </Button>
            )}
          </>
        }
      />

      <section aria-labelledby="flujo" className="detail-block">
        <h2 id="flujo" className="h5">
          Flujo de trabajo: {workflow.name}
        </h2>
        {moveError && (
          <Alert variant="danger" role="alert" dismissible onClose={() => setMoveError(null)}>
            {moveError}
          </Alert>
        )}
        <WorkflowStepper
          workflow={workflow}
          current={process.status}
          canEdit={can('process:edit')}
          onMove={(s) =>
            move(process, s)
              .then(() => setMoveError(null))
              .catch((e: Error) => setMoveError(e.message))
          }
        />
        {info && (
          <dl className="detail-grid mt-3">
            <div>
              <dt>Avance en el flujo</dt>
              <dd>{info.workflowPct}%</dd>
            </div>
            <div>
              <dt>Tareas completadas</dt>
              <dd>{info.tasksTotal ? `${info.tasksDone} de ${info.tasksTotal} (${info.tasksPct}%)` : 'Sin tareas'}</dd>
            </div>
            <div>
              <dt>Avance general</dt>
              <dd>{info.progress}%</dd>
            </div>
            <div>
              <dt>Situación</dt>
              <dd>{info.finished ? 'Finalizado' : info.overdue ? <Badge bg="danger">Vencido</Badge> : 'En curso'}</dd>
            </div>
          </dl>
        )}
      </section>

      <section aria-labelledby="datos" className="detail-block">
        <h2 id="datos" className="h5">
          Datos
        </h2>
        <ProcessForm
          key={process.updatedAt}
          mode="view"
          initial={{ ...process }}
          currentStatus={process.status}
          summary={process.aiSummary}
        />
        <p className="small text-secondary mt-3 mb-0">Creado por {nameOf(process.ownerId)}.</p>
      </section>

      <section aria-labelledby="tareas" className="detail-block">
        <h2 id="tareas" className="h5">
          Tareas del proceso
        </h2>
        <TaskList processId={process.id} embedded />
      </section>

      <section aria-labelledby="archivos" className="detail-block">
        <h2 id="archivos" className="h5">
          Archivos y documentos
        </h2>
        <FileManager entityType="process" entityId={process.id} entityTitle={process.title} />
      </section>

      {can('ai:use') && (
        <section aria-labelledby="ia" className="detail-block">
          <h2 id="ia" className="h5">
            Asistente IA
          </h2>
          <AIAssistant text={`${process.title}. ${process.description}`} process={process} />
        </section>
      )}

      <section aria-labelledby="historial" className="detail-block">
        <h2 id="historial" className="h5">
          Historial de cambios
        </h2>
        <HistoryTimeline entityId={process.id} />
      </section>
    </>
  )
}
