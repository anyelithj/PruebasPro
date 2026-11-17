import { useMemo, useState } from 'react'
import { Badge, Button, Col, Form, Row } from 'react-bootstrap'
import { FiPlus } from 'react-icons/fi'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useProcesses } from '../../hooks/useProcesses'
import { useTasks } from '../../hooks/useTasks'
import { useUsers } from '../../hooks/useUsers'
import {
  PRIORITIES,
  PRIORITY_LABEL,
  PRIORITY_VARIANT,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type Priority,
  type TaskStatus,
} from '../../models'
import { todayIso } from '../../services/dates'
import { emptyTaskFilters, filterTasks, type TaskFilters } from '../../services/filters'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import Spinner from '../accesories/Spinner'
import { formatDate } from '../helpers/ConvertirId'
import { confirmDelete, showError } from '../helpers/confirm'
import TaskForm from './TaskForm'

interface Props {
  processId?: string
  embedded?: boolean
}

export default function TaskList({ processId, embedded = false }: Props) {
  const [params] = useSearchParams()
  const { tasks, loading, add, move, remove } = useTasks(processId)
  const { processes } = useProcesses()
  const { users, nameOf } = useUsers()
  const { can, user } = useAuth()
  const [filters, setFilters] = useState<TaskFilters>({
    ...emptyTaskFilters,
    assigneeId: params.get('mias') === '1' ? (user?.uid ?? '') : '',
  })
  const set = <K extends keyof TaskFilters>(key: K, v: TaskFilters[K]) => setFilters((f) => ({ ...f, [key]: v }))
  const visible = useMemo(() => filterTasks(tasks, filters), [tasks, filters])
  const today = todayIso()

  const handleDelete = async (t: (typeof tasks)[number]) => {
    if (await confirmDelete(`¿Eliminar la tarea «${t.title}»?`)) await remove(t).catch(showError)
  }

  return (
    <>
      {!embedded && (
        <>
          <Seo title="Tareas" noIndex />
          <PageHeader
            title="Tareas"
            subtitle="Todas las tareas del equipo."
            actions={
              can('task:create') && (
                <Link to="/app/tareas/nueva" className="btn btn-primary">
                  <FiPlus aria-hidden="true" /> Nueva tarea
                </Link>
              )
            }
          />
          <Form
            role="search"
            aria-label="Filtros de tareas"
            className="filter-form mb-3"
            onSubmit={(e) => e.preventDefault()}
          >
            <Row className="g-3">
              <Col md={4}>
                <Form.Label htmlFor="tl-text">Buscar</Form.Label>
                <Form.Control
                  id="tl-text"
                  type="search"
                  value={filters.text}
                  onChange={(e) => set('text', e.target.value)}
                />
              </Col>
              <Col sm={6} md={2}>
                <Form.Label htmlFor="tl-status">Estado</Form.Label>
                <Form.Select
                  id="tl-status"
                  value={filters.status}
                  onChange={(e) => set('status', e.target.value as TaskStatus | '')}
                >
                  <option value="">Todos</option>
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {TASK_STATUS_LABEL[s]}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col sm={6} md={2}>
                <Form.Label htmlFor="tl-priority">Prioridad</Form.Label>
                <Form.Select
                  id="tl-priority"
                  value={filters.priority}
                  onChange={(e) => set('priority', e.target.value as Priority | '')}
                >
                  <option value="">Todas</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col sm={6} md={2}>
                <Form.Label htmlFor="tl-assignee">Responsable</Form.Label>
                <Form.Select
                  id="tl-assignee"
                  value={filters.assigneeId}
                  onChange={(e) => set('assigneeId', e.target.value)}
                >
                  <option value="">Todos</option>
                  {users.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName || u.email}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col sm={6} md={2}>
                <Form.Label htmlFor="tl-process">Proceso</Form.Label>
                <Form.Select
                  id="tl-process"
                  value={filters.processId}
                  onChange={(e) => set('processId', e.target.value)}
                >
                  <option value="">Todos</option>
                  {processes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col sm={6} md={3}>
                <Form.Label htmlFor="tl-from">Vence desde</Form.Label>
                <Form.Control
                  id="tl-from"
                  type="date"
                  value={filters.dueFrom}
                  onChange={(e) => set('dueFrom', e.target.value)}
                />
              </Col>
              <Col sm={6} md={3}>
                <Form.Label htmlFor="tl-to">Vence hasta</Form.Label>
                <Form.Control
                  id="tl-to"
                  type="date"
                  value={filters.dueTo}
                  onChange={(e) => set('dueTo', e.target.value)}
                />
              </Col>
              <Col md={6} className="d-flex align-items-end gap-3">
                <Form.Check
                  type="switch"
                  id="tl-overdue"
                  label="Solo vencidas"
                  checked={filters.overdueOnly}
                  onChange={(e) => set('overdueOnly', e.target.checked)}
                />
                <Button variant="link" onClick={() => setFilters(emptyTaskFilters)}>
                  Limpiar filtros
                </Button>
              </Col>
            </Row>
          </Form>
        </>
      )}
      {embedded && can('task:create') && (
        <TaskForm
          mode="create"
          className="task-form"
          processId={processId}
          submitLabel="Agregar tarea"
          resetOnSubmit
          onSubmit={add}
        />
      )}
      <p aria-live="polite" className="text-secondary small mt-3 mb-0">
        {visible.length} tarea(s)
      </p>
      {loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <p className="empty-state mt-3">No hay tareas para mostrar.</p>
      ) : (
        <ul className="row-list">
          {visible.map((t) => (
            <li key={t.id} className="row-list__item">
              <div>
                <Link
                  to={`/app/tareas/${t.id}`}
                  className={`fw-bold${t.status === 'done' ? ' text-decoration-line-through' : ''}`}
                >
                  {t.title}
                </Link>
                <div className="small text-secondary">
                  {nameOf(t.assigneeId)} · Vence: {formatDate(t.dueDate)}{' '}
                  <Badge bg={PRIORITY_VARIANT[t.priority]} text={t.priority === 'high' ? 'dark' : undefined}>
                    {PRIORITY_LABEL[t.priority]}
                  </Badge>
                  {t.status !== 'done' && t.dueDate && t.dueDate < today && (
                    <Badge bg="danger" className="ms-1">
                      Vencida
                    </Badge>
                  )}
                </div>
              </div>
              <div className="row-list__actions">
                <Form.Select
                  size="sm"
                  aria-label={`Estado de ${t.title}`}
                  value={t.status}
                  disabled={!can('task:edit')}
                  onChange={(e) => move(t, e.target.value as TaskStatus).catch(showError)}
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {TASK_STATUS_LABEL[s]}
                    </option>
                  ))}
                </Form.Select>
                <Link to={`/app/tareas/${t.id}`} className="btn btn-sm btn-outline-primary">
                  Ver
                </Link>
                {can('task:edit') && (
                  <Link to={`/app/tareas/${t.id}/editar`} className="btn btn-sm btn-outline-secondary">
                    Editar
                  </Link>
                )}
                {can('task:delete') && (
                  <Button variant="outline-danger" size="sm" onClick={() => handleDelete(t)}>
                    Eliminar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
