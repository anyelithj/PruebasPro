import { useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useTasks } from '../../hooks/useTasks'
import { useUsers } from '../../hooks/useUsers'
import { TASK_STATUSES, TASK_STATUS_LABEL, type TaskStatus } from '../../models'
import { showError } from '../helpers/confirm'
import KanbanColumn from './KanbanColumn'
import TaskCard from './TaskCard'

export default function TaskKanban() {
  const { tasks, move } = useTasks()
  const { nameOf } = useUsers()
  const { can } = useAuth()
  const dragging = useRef<string | null>(null)

  const drop = (status: TaskStatus) => {
    const task = tasks.find((t) => t.id === dragging.current)
    dragging.current = null
    if (task) move(task, status).catch(showError)
  }

  return (
    <div className="kanban">
      {TASK_STATUSES.map((status) => {
        const items = tasks.filter((t) => t.status === status)
        return (
          <KanbanColumn
            key={status}
            id={status}
            title={TASK_STATUS_LABEL[status]}
            count={items.length}
            onDropItem={() => drop(status)}
          >
            {items.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                assignee={nameOf(t.assigneeId)}
                canEdit={can('task:edit')}
                onMove={(s) => move(t, s).catch(showError)}
                onDragStart={(id) => (dragging.current = id)}
              />
            ))}
          </KanbanColumn>
        )
      })}
    </div>
  )
}
