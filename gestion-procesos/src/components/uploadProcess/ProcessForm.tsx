// ═══════════════════════════════════════════════════════════════════════════════════════
// ProcessForm.tsx — UN SOLO formulario para CREAR, EDITAR y VER EL DETALLE de un proceso.
// Lo usan: AddProcess (mode="create"), EditProcesses (mode="edit") y DetailProcess (mode="view").
// Patrones: CONTAINER (maneja estado y lógica con hooks) + COMPOSITION (usa FormShell, que recibe los campos como `children`).
// Principios: DRY (un formulario en vez de tres), SRP (este archivo solo conoce los campos de un proceso).
// ═══════════════════════════════════════════════════════════════════════════════════════

// Componentes de interfaz de react-bootstrap: `Row`/`Col` forman la rejilla responsive de 12 columnas.
import { Alert, Button, Col, Form, Row } from 'react-bootstrap'
// Icono de la librería react-icons (Feather).
import { FiCpu } from 'react-icons/fi'
// Custom hooks (lógica reutilizable): IA local, estado del formulario, estado de guardado, usuarios y flujos.
import { useAI } from '../../hooks/useAI'
import { useForm } from '../../hooks/useForm'
import { useFormSubmit } from '../../hooks/useFormSubmit'
import { useUsers } from '../../hooks/useUsers'
import { useWorkflow } from '../../hooks/useWorkflow'
import { PRIORITIES, PRIORITY_LABEL, type Priority, type ProcessKind } from '../../models'
import type { ProcessInput } from '../../redux/actions/actionProcess'
import { initialState } from '../../services/workflow'
import FormShell, { type FormMode } from '../accesories/FormShell'

// Forma de los valores que maneja el formulario (todos son texto, salvo los responsables, que son un arreglo).
export interface ProcessFormValues {
  title: string
  description: string
  // Tipo unión: solo 'proceso' o 'solicitud'.
  kind: ProcessKind
  priority: Priority
  category: string
  workflowId: string
  startDate: string
  dueDate: string
  // `string[]`: arreglo de uid de los responsables.
  assigneeIds: string[]
}

// Valores de un formulario vacío (modo «create»). Se exporta para reutilizarlo en pruebas e historias de Storybook.
export const emptyProcess: ProcessFormValues = {
  title: '',
  description: '',
  kind: 'proceso',
  priority: 'medium',
  category: '',
  workflowId: 'default',
  startDate: '',
  dueDate: '',
  assigneeIds: [],
}

// Props (propiedades) que recibe el componente; `?` marca las opcionales.
interface Props {
  mode: FormMode
  initial?: ProcessFormValues
  submitLabel?: string
  /** Estado actual del proceso (editar y ver). El estado cambia desde el flujo, no desde el formulario. */
  currentStatus?: string
  /** Resumen guardado por el asistente de IA; se muestra solo en modo «view». */
  summary?: string
  // Función que guarda; devuelve una Promesa (asíncrona). Solo existe en create/edit.
  onSubmit?: (input: ProcessInput) => Promise<void>
}

/** Un solo formulario para crear, editar y ver el detalle de un proceso. */
// Valores por defecto en la desestructuración de props: `initial = emptyProcess`, `submitLabel = 'Crear proceso'`.
export default function ProcessForm({
  mode,
  initial = emptyProcess,
  submitLabel = 'Crear proceso',
  currentStatus,
  summary,
  onSubmit,
}: Props) {
  // Estado de los campos: `values` (valores actuales), `handleChange` (para <input>), `setField` (para campos especiales).
  const { values, handleChange, setField } = useForm<ProcessFormValues>(initial)
  // Datos del store (Redux) a través de hooks: usuarios (para elegir responsables) y flujos (para elegir el workflow).
  const { users } = useUsers()
  const { workflows, getWorkflow } = useWorkflow()
  // IA local gratuita: `analyze` genera la sugerencia y `result` la guarda.
  const { result, analyze } = useAI()
  // Estado de guardado: `saving`, `error`, `setError` y `run` (ejecuta la acción con try/catch).
  const { saving, error, setError, run } = useFormSubmit()
  // Variable derivada: ¿se puede editar? (todo menos el modo «view»).
  const editable = mode !== 'view'

  // Se ejecuta al pulsar el botón del formulario (FormShell llama a esta función).
  const submit = () => {
    // Validación 1: el título es obligatorio. `trim()` quita espacios; `!` niega (texto vacío = falso).
    // `return setError(...)`: muestra el error y corta la función.
    if (!values.title.trim()) return setError('El título es obligatorio.')
    // Validación 2: coherencia de fechas. Las fechas AAAA-MM-DD se pueden comparar como texto.
    if (values.startDate && values.dueDate && values.startDate > values.dueDate) {
      return setError('La fecha de inicio no puede ser posterior a la fecha límite.')
    }
    // `run(...)`: ejecuta el guardado con manejo de errores. `onSubmit?.(...)`: llama a la función solo si existe.
    return run(() =>
      onSubmit?.({
        ...values,
        title: values.title.trim(),
        // Al crear: primer estado del flujo elegido. Al editar: conserva el estado actual.
        status: currentStatus ?? initialState(getWorkflow(values.workflowId)),
      }),
    )
  }

  return (
    // FormShell pone el <form>, el aviso de error, el <fieldset disabled> en modo vista y el botón. Los campos van como `children`.
    <FormShell
      mode={mode}
      label="Formulario de proceso"
      error={error}
      saving={saving}
      submitLabel={submitLabel}
      onSubmit={submit}
    >
      {/* Rejilla Bootstrap: `g-3` = separación entre columnas. */}
      <Row className="g-3">
        {/* xs={12}: ocupa todo el ancho. */}
        <Col xs={12}>
          {/* `htmlFor` (equivale a `for` de HTML): asocia la etiqueta con el campo cuyo id coincide → accesibilidad. */}
          {/* `{editable && ' *'}`: solo en modo edición agrega el asterisco de obligatorio. */}
          <Form.Label htmlFor="pf-title">Título{editable && ' *'}</Form.Label>
          {/* Campo controlado: su valor viene del estado de React y cada cambio lo actualiza (`onChange`). */}
          <Form.Control id="pf-title" name="title" value={values.title} onChange={handleChange} required />
        </Col>
        <Col xs={12}>
          <Form.Label htmlFor="pf-description">Descripción</Form.Label>
          {/* `as="textarea"`: renderiza un <textarea> en vez de <input>. */}
          <Form.Control
            id="pf-description"
            as="textarea"
            rows={4}
            name="description"
            value={values.description}
            onChange={handleChange}
          />
          {/* Solo en modo vista: muestra el resumen de la IA si existe y es distinto de la descripción. */}
          {!editable && summary && summary !== values.description && (
            <Form.Text as="p" className="mb-0">
              <strong>Resumen IA:</strong> {summary}
            </Form.Text>
          )}
        </Col>
        {/* Bloque de IA: solo se muestra cuando se puede editar. */}
        {editable && (
          <Col xs={12}>
            {/* `type="button"`: evita que este botón envíe el formulario. */}
            <Button
              type="button"
              variant="outline-primary"
              size="sm"
              // Genera la sugerencia con el título y la descripción actuales.
              onClick={() => analyze(`${values.title}. ${values.description}`)}
              // Deshabilitado si no hay nada que analizar.
              disabled={!values.title && !values.description}
            >
              {/* `aria-hidden`: el icono es decorativo; el lector de pantalla lo ignora. */}
              <FiCpu aria-hidden="true" /> Sugerir categoría y prioridad con IA
            </Button>
            {/* Si hay resultado, lo muestra. `role="status"`: se anuncia de forma educada a lectores de pantalla. */}
            {result && (
              <Alert variant="info" className="mt-2 mb-0" role="status">
                Sugerencia: categoría <strong>{result.category}</strong>, prioridad{' '}
                <strong>{PRIORITY_LABEL[result.priority].toLowerCase()}</strong>.{' '}
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 align-baseline"
                  // Aplica la sugerencia a los campos del formulario.
                  onClick={() => {
                    setField('category', result.category)
                    setField('priority', result.priority)
                  }}
                >
                  Aplicar
                </Button>
              </Alert>
            )}
          </Col>
        )}
        {/* sm/md: columnas responsive (en pantallas pequeñas 6 de 12, en medianas 3 de 12). */}
        <Col sm={6} md={3}>
          <Form.Label htmlFor="pf-kind">Tipo</Form.Label>
          {/* <select> controlado. `name` permite que handleChange sepa qué campo actualizar. */}
          <Form.Select id="pf-kind" name="kind" value={values.kind} onChange={handleChange}>
            <option value="proceso">Proceso</option>
            <option value="solicitud">Solicitud</option>
          </Form.Select>
        </Col>
        <Col sm={6} md={3}>
          <Form.Label htmlFor="pf-priority">Prioridad</Form.Label>
          <Form.Select id="pf-priority" name="priority" value={values.priority} onChange={handleChange}>
            {/* `map` genera una <option> por cada prioridad. `key`: identificador único que React necesita en listas. */}
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Form.Select>
        </Col>
        <Col sm={6} md={3}>
          <Form.Label htmlFor="pf-category">Categoría</Form.Label>
          {/* `aria-describedby`: asocia el texto de ayuda al campo para lectores de pantalla. */}
          <Form.Control
            id="pf-category"
            name="category"
            value={values.category}
            onChange={handleChange}
            aria-describedby={editable ? 'pf-category-help' : undefined}
          />
          {editable && <Form.Text id="pf-category-help">Si la dejas vacía, la IA la completa al guardar.</Form.Text>}
        </Col>
        <Col sm={6} md={3}>
          <Form.Label htmlFor="pf-status">Estado</Form.Label>
          {/* Siempre solo lectura: el estado cambia desde el flujo (botones «Avanzar/Volver»), no desde el formulario. */}
          <Form.Control
            id="pf-status"
            value={currentStatus ?? initialState(getWorkflow(values.workflowId))}
            readOnly
            disabled
          />
        </Col>
        <Col sm={6} md={3}>
          <Form.Label htmlFor="pf-start">Fecha de inicio</Form.Label>
          {/* `type="date"`: selector de fecha nativo del navegador (formato AAAA-MM-DD). */}
          <Form.Control id="pf-start" type="date" name="startDate" value={values.startDate} onChange={handleChange} />
        </Col>
        <Col sm={6} md={3}>
          <Form.Label htmlFor="pf-due">Fecha límite</Form.Label>
          <Form.Control id="pf-due" type="date" name="dueDate" value={values.dueDate} onChange={handleChange} />
        </Col>
        <Col sm={12} md={6}>
          <Form.Label htmlFor="pf-workflow">Flujo de trabajo</Form.Label>
          {/* El flujo solo se elige al crear: cambiarlo después dejaría el estado actual sin sentido. */}
          <Form.Select
            id="pf-workflow"
            name="workflowId"
            value={values.workflowId}
            onChange={handleChange}
            disabled={mode !== 'create'}
          >
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {/* `join(' → ')`: muestra el recorrido del flujo. */}
                {w.name} ({w.states.join(' → ')})
              </option>
            ))}
          </Form.Select>
        </Col>
        <Col xs={12}>
          <Form.Label htmlFor="pf-assignees">Responsables</Form.Label>
          {/* `multiple`: permite elegir varias personas. `htmlSize`: cuántas filas se ven. */}
          <Form.Select
            id="pf-assignees"
            multiple
            htmlSize={4}
            aria-describedby={editable ? 'pf-assignees-help' : undefined}
            value={values.assigneeIds}
            // En un <select multiple> el valor son TODAS las opciones marcadas. `Array.from(..., fn)` convierte la colección en arreglo.
            onChange={(e) =>
              setField(
                'assigneeIds',
                Array.from(e.target.selectedOptions, (o) => o.value),
              )
            }
          >
            {/* Muestra usuarios activos (y los ya asignados aunque se hayan desactivado, para no perder el dato). */}
            {users
              .filter((u) => u.active || values.assigneeIds.includes(u.uid))
              .map((u) => (
                <option key={u.uid} value={u.uid}>
                  {/* `||`: si no tiene nombre, muestra el correo. */}
                  {u.displayName || u.email}
                </option>
              ))}
          </Form.Select>
          {editable && <Form.Text id="pf-assignees-help">Mantén Ctrl o ⌘ para elegir varias personas.</Form.Text>}
        </Col>
      </Row>
    </FormShell>
  )
}
