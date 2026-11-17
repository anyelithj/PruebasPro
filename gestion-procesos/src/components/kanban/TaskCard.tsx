import { Badge, Form } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import {
  PRIORITY_LABEL,
  PRIORITY_VARIANT,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type Task,
  type TaskStatus,
} from '../../models'
import { formatDate } from '../helpers/ConvertirId'

interface Props {
  task: Task
  assignee: string
  canEdit: boolean
  onMove: (status: TaskStatus) => void
  onDragStart: (id: string) => void
}

/** Presentacional: tarjeta arrastrable. El selector «Mover a» es la alternativa accesible al arrastre. */
export default function TaskCard({ task, assignee, canEdit, onMove, onDragStart }: Props) {
  return (
    <li
      className="kanban__card"
      draggable={canEdit}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id)
        onDragStart(task.id)
      }}
    >
      <Link to={`/app/tareas/${task.id}`} className="fw-bold">
        {task.title}
      </Link>
      <div className="small text-secondary">
        {assignee} · {formatDate(task.dueDate)}
      </div>
      <Badge bg={PRIORITY_VARIANT[task.priority]} text={task.priority === 'high' ? 'dark' : undefined}>
        {PRIORITY_LABEL[task.priority]}
      </Badge>
      {canEdit && (
        <Form.Select
          size="sm"
          className="mt-2"
          aria-label={`Mover «${task.title}» a`}
          value={task.status}
          onChange={(e) => onMove(e.target.value as TaskStatus)}
        >
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABEL[s]}
            </option>
          ))}
        </Form.Select>
      )}
    </li>
  )
}
