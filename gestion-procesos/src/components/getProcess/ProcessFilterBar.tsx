import { Col, Form, Row } from 'react-bootstrap'
import { useUsers } from '../../hooks/useUsers'
import { useWorkflow } from '../../hooks/useWorkflow'
import { PRIORITIES, PRIORITY_LABEL, type Priority, type Process, type ProcessKind } from '../../models'
import type { ProcessFilters } from '../../services/filters'

interface Props {
  value: ProcessFilters
  onChange: (f: ProcessFilters) => void
  processes: Process[]
}

/** Barra de búsqueda y filtros avanzados (controlada). */
export default function ProcessFilterBar({ value, onChange, processes }: Props) {
  const { users } = useUsers()
  const { workflows } = useWorkflow()
  const set = <K extends keyof ProcessFilters>(key: K, v: ProcessFilters[K]) => onChange({ ...value, [key]: v })
  const categories = [...new Set(processes.map((p) => p.category).filter(Boolean))]
  const statuses = [
    ...new Set(workflows.filter((w) => !value.workflowId || w.id === value.workflowId).flatMap((w) => w.states)),
  ]
  const people = users.map((u) => (
    <option key={u.uid} value={u.uid}>
      {u.displayName || u.email}
    </option>
  ))

  return (
    <Form role="search" aria-label="Búsqueda y filtros" className="filter-form" onSubmit={(e) => e.preventDefault()}>
      <Row className="g-3">
        <Col md={6} lg={4}>
          <Form.Label htmlFor="f-text">Buscar</Form.Label>
          <Form.Control
            id="f-text"
            type="search"
            value={value.text}
            onChange={(e) => set('text', e.target.value)}
            placeholder="Título, descripción, categoría o resumen"
          />
        </Col>
        <Col sm={6} md={3} lg={2}>
          <Form.Label htmlFor="f-wf">Flujo</Form.Label>
          <Form.Select
            id="f-wf"
            value={value.workflowId}
            onChange={(e) => onChange({ ...value, workflowId: e.target.value, status: '' })}
          >
            <option value="">Todos</option>
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Form.Select>
        </Col>
        <Col sm={6} md={3} lg={2}>
          <Form.Label htmlFor="f-status">Estado</Form.Label>
          <Form.Select id="f-status" value={value.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">Todos</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Form.Select>
        </Col>
        <Col sm={6} md={3} lg={2}>
          <Form.Label htmlFor="f-priority">Prioridad</Form.Label>
          <Form.Select
            id="f-priority"
            value={value.priority}
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
        <Col sm={6} md={3} lg={2}>
          <Form.Label htmlFor="f-kind">Tipo</Form.Label>
          <Form.Select id="f-kind" value={value.kind} onChange={(e) => set('kind', e.target.value as ProcessKind | '')}>
            <option value="">Todos</option>
            <option value="proceso">Proceso</option>
            <option value="solicitud">Solicitud</option>
          </Form.Select>
        </Col>
        <Col sm={6} md={3} lg={2}>
          <Form.Label htmlFor="f-cat">Categoría</Form.Label>
          <Form.Select id="f-cat" value={value.category} onChange={(e) => set('category', e.target.value)}>
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Form.Select>
        </Col>
        <Col sm={6} md={3} lg={2}>
          <Form.Label htmlFor="f-owner">Creado por</Form.Label>
          <Form.Select id="f-owner" value={value.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
            <option value="">Todos</option>
            {people}
          </Form.Select>
        </Col>
        <Col sm={6} md={3} lg={2}>
          <Form.Label htmlFor="f-assignee">Responsable</Form.Label>
          <Form.Select id="f-assignee" value={value.assigneeId} onChange={(e) => set('assigneeId', e.target.value)}>
            <option value="">Todos</option>
            {people}
          </Form.Select>
        </Col>
        <Col sm={6} md={3} lg={2}>
          <Form.Label htmlFor="f-from">Vence desde</Form.Label>
          <Form.Control
            id="f-from"
            type="date"
            value={value.dueFrom}
            onChange={(e) => set('dueFrom', e.target.value)}
          />
        </Col>
        <Col sm={6} md={3} lg={2}>
          <Form.Label htmlFor="f-to">Vence hasta</Form.Label>
          <Form.Control id="f-to" type="date" value={value.dueTo} onChange={(e) => set('dueTo', e.target.value)} />
        </Col>
        <Col sm={6} md={3} lg={2}>
          <Form.Label htmlFor="f-sort">Ordenar por</Form.Label>
          <Form.Select
            id="f-sort"
            value={value.sort}
            onChange={(e) => set('sort', e.target.value as ProcessFilters['sort'])}
          >
            <option value="recent">Más recientes</option>
            <option value="due">Fecha límite</option>
            <option value="priority">Prioridad</option>
            <option value="title">Título</option>
          </Form.Select>
        </Col>
        <Col xs={12} className="d-flex flex-wrap gap-4 align-items-center">
          <Form.Check
            type="switch"
            id="f-overdue"
            label="Solo vencidos"
            checked={value.overdueOnly}
            onChange={(e) => set('overdueOnly', e.target.checked)}
          />
          <Form.Check
            type="switch"
            id="f-active"
            label="Ocultar finalizados"
            checked={value.onlyActive}
            onChange={(e) => set('onlyActive', e.target.checked)}
          />
        </Col>
      </Row>
    </Form>
  )
}
