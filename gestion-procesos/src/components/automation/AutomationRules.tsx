import { useState, type FormEvent } from 'react'
import { Button, Col, Form, Row } from 'react-bootstrap'
import { FiTrash2 } from 'react-icons/fi'
import { useAutomation } from '../../hooks/useAutomation'
import { useUsers } from '../../hooks/useUsers'
import {
  PRIORITIES,
  PRIORITY_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type ActionType,
  type TriggerType,
} from '../../models'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import { confirmDelete } from '../helpers/confirm'

const TRIGGERS: Record<TriggerType, string> = {
  task_created: 'Se crea una tarea',
  task_status: 'Una tarea cambia de estado',
  process_created: 'Se crea un proceso',
  process_status: 'Un proceso cambia de estado',
}
const ACTIONS: Record<ActionType, string> = {
  notify: 'Enviar una notificación',
  assign: 'Asignar a una persona',
  set_priority: 'Cambiar la prioridad',
  create_task: 'Crear una tarea en el proceso',
}

export default function AutomationRules() {
  const { rules, add, toggle, remove } = useAutomation()
  const { users } = useUsers()
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState<TriggerType>('task_status')
  const [triggerValue, setTriggerValue] = useState('done')
  const [action, setAction] = useState<ActionType>('notify')
  const [actionValue, setActionValue] = useState('')

  const changeAction = (a: ActionType) => {
    setAction(a)
    setActionValue(a === 'set_priority' ? 'high' : '')
  }
  const changeTrigger = (t: TriggerType) => {
    setTrigger(t)
    setTriggerValue(t === 'task_status' ? 'done' : '')
  }
  const describeAction = (r: (typeof rules)[number]) =>
    r.action.type === 'create_task' ? `${ACTIONS.create_task}: «${r.action.value}»` : ACTIONS[r.action.type]

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await add({
      name: name.trim(),
      trigger: { type: trigger, value: triggerValue },
      action: { type: action, value: actionValue },
    })
    setName('')
  }

  const describe = (r: (typeof rules)[number]) =>
    `${TRIGGERS[r.trigger.type]}${r.trigger.value ? ` a «${r.trigger.type === 'task_status' ? (TASK_STATUS_LABEL[r.trigger.value as keyof typeof TASK_STATUS_LABEL] ?? r.trigger.value) : r.trigger.value}»` : ''} → ${describeAction(r)}`

  return (
    <>
      <Seo title="Automatizaciones" noIndex />
      <PageHeader
        title="Automatizaciones"
        subtitle="Reglas «cuando pase X, haz Y». Se ejecutan cuando alguien mueve una tarea o un proceso."
      />
      <Form onSubmit={submit} className="form-panel mb-4">
        <Row className="g-3">
          <Col xs={12}>
            <Form.Label htmlFor="au-name">Nombre de la regla</Form.Label>
            <Form.Control id="au-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Col>
          <Col md={6}>
            <Form.Label htmlFor="au-trigger">Cuando</Form.Label>
            <Form.Select id="au-trigger" value={trigger} onChange={(e) => changeTrigger(e.target.value as TriggerType)}>
              {Object.entries(TRIGGERS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Form.Select>
          </Col>
          {(trigger === 'task_status' || trigger === 'process_status') && (
            <Col md={6}>
              <Form.Label htmlFor="au-tvalue">
                {trigger === 'task_status' ? 'Nuevo estado' : 'Nuevo estado (texto exacto)'}
              </Form.Label>
              {trigger === 'task_status' ? (
                <Form.Select id="au-tvalue" value={triggerValue} onChange={(e) => setTriggerValue(e.target.value)}>
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {TASK_STATUS_LABEL[s]}
                    </option>
                  ))}
                </Form.Select>
              ) : (
                <Form.Control
                  id="au-tvalue"
                  value={triggerValue}
                  onChange={(e) => setTriggerValue(e.target.value)}
                  placeholder="Aprobado"
                />
              )}
            </Col>
          )}
          <Col md={6}>
            <Form.Label htmlFor="au-action">Entonces</Form.Label>
            <Form.Select id="au-action" value={action} onChange={(e) => changeAction(e.target.value as ActionType)}>
              {Object.entries(ACTIONS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col md={6}>
            <Form.Label htmlFor="au-avalue">
              {action === 'set_priority'
                ? 'Prioridad'
                : action === 'assign'
                  ? 'Persona'
                  : action === 'create_task'
                    ? 'Título de la tarea'
                    : 'Avisar a (opcional)'}
            </Form.Label>
            {action === 'create_task' ? (
              <Form.Control
                id="au-avalue"
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                placeholder="Revisar solicitud"
                required
              />
            ) : (
              <Form.Select
                id="au-avalue"
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                required={action === 'assign'}
              >
                {action === 'set_priority' ? (
                  PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="">{action === 'assign' ? 'Elige una persona' : 'Responsable del elemento'}</option>
                    {users.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.displayName || u.email}
                      </option>
                    ))}
                  </>
                )}
              </Form.Select>
            )}
          </Col>
        </Row>
        <Button type="submit" className="mt-3">
          Crear regla
        </Button>
      </Form>

      {rules.length === 0 ? (
        <p className="empty-state">Aún no hay reglas.</p>
      ) : (
        <ul className="row-list">
          {rules.map((r) => (
            <li key={r.id} className="row-list__item">
              <div>
                <strong>{r.name}</strong>
                <div className="small text-secondary">{describe(r)}</div>
              </div>
              <div className="row-list__actions">
                <Form.Check
                  type="switch"
                  id={`rule-${r.id}`}
                  label="Activa"
                  checked={r.enabled}
                  onChange={() => toggle(r)}
                />
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={async () => {
                    if (await confirmDelete(`¿Eliminar la regla «${r.name}»?`)) remove(r.id)
                  }}
                  aria-label={`Eliminar ${r.name}`}
                >
                  <FiTrash2 aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
