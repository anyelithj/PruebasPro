import { Col, Form, Row } from 'react-bootstrap'
import { useForm } from '../../hooks/useForm'
import { useFormSubmit } from '../../hooks/useFormSubmit'
import { useProcesses } from '../../hooks/useProcesses'
import type { TaskInput } from '../../hooks/useTasks'
import { useUsers } from '../../hooks/useUsers'
import { PRIORITIES, PRIORITY_LABEL, TASK_STATUSES, TASK_STATUS_LABEL } from '../../models'
import FormShell, { type FormMode } from '../accesories/FormShell'

interface Props {
  mode: FormMode
  initial?: TaskInput
  /** Si se indica, la tarea queda vinculada a ese proceso y no se muestra el selector. */
  processId?: string
  submitLabel?: string
  resetOnSubmit?: boolean
  className?: string
  onSubmit?: (input: TaskInput) => Promise<unknown>
}

export const emptyTask: TaskInput = {
  title: '',
  description: '',
  processId: '',
  priority: 'medium',
  status: 'todo',
  assigneeId: '',
  dueDate: '',
}

/** Un solo formulario para crear, editar y ver el detalle de una tarea (también al agregarla desde un proceso). */
export default function TaskForm({
  mode,
  initial = emptyTask,
  processId,
  submitLabel = 'Crear tarea',
  resetOnSubmit = false,
  className,
  onSubmit,
}: Props) {
  const { values, handleChange, reset } = useForm<TaskInput>(processId ? { ...initial, processId } : initial)
  const { users } = useUsers()
  const { processes } = useProcesses()
  const { saving, error, setError, run } = useFormSubmit('No se pudo guardar la tarea.')
  const editable = mode !== 'view'
  const k = `${mode}-${processId ?? 'all'}`

  const submit = async () => {
    if (!values.title.trim()) return setError('El título es obligatorio.')
    const ok = await run(() => onSubmit?.({ ...values, title: values.title.trim() }))
    if (ok && resetOnSubmit) reset()
  }

  return (
    <FormShell
      mode={mode}
      label="Formulario de tarea"
      error={error}
      saving={saving}
      submitLabel={submitLabel}
      className={className}
      onSubmit={submit}
    >
      <Row className="g-2">
        <Col xs={12} md={6}>
          <Form.Label htmlFor={`tf-title-${k}`}>Título{editable && ' *'}</Form.Label>
          <Form.Control
            id={`tf-title-${k}`}
            name="title"
            value={values.title}
            onChange={handleChange}
            placeholder={editable ? '¿Qué hay que hacer?' : undefined}
            required
          />
        </Col>
        <Col xs={12} md={6}>
          <Form.Label htmlFor={`tf-desc-${k}`}>Descripción</Form.Label>
          <Form.Control id={`tf-desc-${k}`} name="description" value={values.description} onChange={handleChange} />
        </Col>
        {!processId && (
          <Col sm={6} md={3}>
            <Form.Label htmlFor={`tf-process-${k}`}>Proceso</Form.Label>
            <Form.Select id={`tf-process-${k}`} name="processId" value={values.processId} onChange={handleChange}>
              <option value="">Sin proceso</option>
              {processes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Form.Select>
          </Col>
        )}
        <Col sm={6} md={3}>
          <Form.Label htmlFor={`tf-assignee-${k}`}>Responsable</Form.Label>
          <Form.Select id={`tf-assignee-${k}`} name="assigneeId" value={values.assigneeId} onChange={handleChange}>
            <option value="">Sin asignar</option>
            {users
              .filter((u) => u.active || u.uid === values.assigneeId)
              .map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.displayName || u.email}
                </option>
              ))}
          </Form.Select>
        </Col>
        <Col sm={6} md={2}>
          <Form.Label htmlFor={`tf-status-${k}`}>Estado</Form.Label>
          <Form.Select id={`tf-status-${k}`} name="status" value={values.status} onChange={handleChange}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABEL[s]}
              </option>
            ))}
          </Form.Select>
        </Col>
        <Col sm={6} md={2}>
          <Form.Label htmlFor={`tf-priority-${k}`}>Prioridad</Form.Label>
          <Form.Select id={`tf-priority-${k}`} name="priority" value={values.priority} onChange={handleChange}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Form.Select>
        </Col>
        <Col sm={6} md={2}>
          <Form.Label htmlFor={`tf-due-${k}`}>Fecha límite</Form.Label>
          <Form.Control id={`tf-due-${k}`} type="date" name="dueDate" value={values.dueDate} onChange={handleChange} />
        </Col>
      </Row>
    </FormShell>
  )
}
