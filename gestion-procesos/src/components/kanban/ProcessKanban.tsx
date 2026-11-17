import { useRef, useState } from 'react'
import { Alert, Form } from 'react-bootstrap'
import { useAuth } from '../../hooks/useAuth'
import { useDashboard } from '../../hooks/useDashboard'
import { useProcesses } from '../../hooks/useProcesses'
import { useUsers } from '../../hooks/useUsers'
import { useWorkflow } from '../../hooks/useWorkflow'
import { todayIso } from '../../services/dates'
import KanbanColumn from './KanbanColumn'
import ProcessCard from './ProcessCard'

/** Tablero de procesos: una columna por estado del workflow elegido. */
export default function ProcessKanban() {
  const { processes, move, isFinished } = useProcesses()
  const { workflows, getWorkflow } = useWorkflow()
  const { nameOf } = useUsers()
  const { can } = useAuth()
  const { progress } = useDashboard()
  const [workflowId, setWorkflowId] = useState('default')
  const [error, setError] = useState<string | null>(null)
  const dragging = useRef<string | null>(null)

  const workflow = getWorkflow(workflowId)
  const own = processes.filter((p) => p.workflowId === workflow.id)
  const progressOf = new Map(progress.map((p) => [p.processId, p.progress]))
  const today = todayIso()

  const moveTo = (id: string, status: string) => {
    const p = processes.find((x) => x.id === id)
    if (p && p.status !== status)
      move(p, status)
        .then(() => setError(null))
        .catch((e: Error) => setError(e.message))
  }

  return (
    <>
      <Form.Group className="mb-3 filter-form" controlId="kb-workflow">
        <Form.Label>Flujo de trabajo</Form.Label>
        <Form.Select value={workflowId} onChange={(e) => setWorkflowId(e.target.value)}>
          {workflows.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Form.Select>
      </Form.Group>
      {error && (
        <Alert variant="warning" role="alert" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <div className="kanban">
        {workflow.states.map((state) => {
          const items = own.filter((p) => p.status === state)
          return (
            <KanbanColumn
              key={state}
              id={`wf-${state}`}
              title={state}
              count={items.length}
              onDropItem={() => dragging.current && moveTo(dragging.current, state)}
            >
              {items.map((p) => (
                <ProcessCard
                  key={p.id}
                  process={p}
                  workflow={workflow}
                  assignee={p.assigneeIds.map(nameOf).join(', ') || 'Sin asignar'}
                  progress={progressOf.get(p.id) ?? 0}
                  overdue={!isFinished(p) && !!p.dueDate && p.dueDate < today}
                  canEdit={can('process:edit')}
                  onMove={(s) => moveTo(p.id, s)}
                  onDragStart={(id) => (dragging.current = id)}
                />
              ))}
            </KanbanColumn>
          )
        })}
      </div>
      <p className="small text-secondary">
        Los procesos solo se mueven un estado hacia adelante o hacia atrás, según el flujo.
      </p>
    </>
  )
}
