import { Badge, Form } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { PRIORITY_LABEL, PRIORITY_VARIANT, type Process, type Workflow } from '../../models'
import { nextStates } from '../../services/workflow'
import { formatDate } from '../helpers/ConvertirId'

interface Props {
  process: Process
  workflow: Workflow
  assignee: string
  progress: number
  overdue: boolean
  canEdit: boolean
  onMove: (status: string) => void
  onDragStart: (id: string) => void
}

export default function ProcessCard({
  process,
  workflow,
  assignee,
  progress,
  overdue,
  canEdit,
  onMove,
  onDragStart,
}: Props) {
  const allowed = nextStates(workflow, process.status)
  return (
    <li
      className="kanban__card"
      draggable={canEdit}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', process.id)
        onDragStart(process.id)
      }}
    >
      <Link to={`/app/procesos/${process.id}`} className="fw-bold">
        {process.title}
      </Link>
      <div className="small text-secondary">
        {assignee} · {formatDate(process.dueDate)}
      </div>
      <div className="d-flex flex-wrap gap-1 my-1">
        <Badge bg={PRIORITY_VARIANT[process.priority]} text={process.priority === 'high' ? 'dark' : undefined}>
          {PRIORITY_LABEL[process.priority]}
        </Badge>
        {overdue && <Badge bg="danger">Vencido</Badge>}
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label={`Avance de ${process.title}`}
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>
      {canEdit && allowed.length > 0 && (
        <Form.Select
          size="sm"
          className="mt-2"
          aria-label={`Mover «${process.title}» a`}
          value=""
          onChange={(e) => e.target.value && onMove(e.target.value)}
        >
          <option value="">Mover a…</option>
          {allowed.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Form.Select>
      )}
    </li>
  )
}
