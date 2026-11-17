import { Form } from 'react-bootstrap'
import { useForm } from '../../hooks/useForm'
import { useFormSubmit } from '../../hooks/useFormSubmit'
import FormShell, { type FormMode } from '../accesories/FormShell'
import WorkflowStepper from './WorkflowStepper'

export interface WorkflowFormValues {
  name: string
  /** Estados separados por comas. */
  states: string
}
export const emptyWorkflow: WorkflowFormValues = { name: '', states: '' }

export const parseStates = (states: string): string[] =>
  states
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

interface Props {
  mode: FormMode
  initial?: WorkflowFormValues
  onSubmit?: (name: string, states: string[]) => Promise<void>
}

/** Un solo formulario para crear, editar y ver el detalle de un workflow. */
export default function WorkflowForm({ mode, initial = emptyWorkflow, onSubmit }: Props) {
  const { values, handleChange } = useForm<WorkflowFormValues>(initial)
  const { saving, error, setError, run } = useFormSubmit('No se pudo guardar.')
  const list = parseStates(values.states)
  const editable = mode !== 'view'

  const submit = () => {
    if (!values.name.trim()) return setError('El nombre del flujo es obligatorio.')
    if (list.length < 2) return setError('Escribe al menos dos estados separados por coma.')
    return run(() => onSubmit?.(values.name.trim(), list))
  }

  return (
    <FormShell
      mode={mode}
      label="Formulario de workflow"
      error={error}
      saving={saving}
      submitLabel={mode === 'create' ? 'Crear flujo' : 'Guardar cambios'}
      onSubmit={submit}
    >
      <Form.Label htmlFor="wf-name">Nombre del flujo</Form.Label>
      <Form.Control id="wf-name" name="name" value={values.name} onChange={handleChange} />
      <Form.Label htmlFor="wf-states" className="mt-3">
        Estados en orden
      </Form.Label>
      <Form.Control
        id="wf-states"
        name="states"
        value={values.states}
        onChange={handleChange}
        aria-describedby={editable ? 'wf-help' : undefined}
        placeholder={editable ? 'Recibida, En análisis, Resuelta' : undefined}
      />
      {editable && <Form.Text id="wf-help">Sepáralos con comas. Mínimo dos; el último es el estado final.</Form.Text>}
      {list.length > 1 && (
        <div className="mt-3">
          <WorkflowStepper
            workflow={{ id: 'preview', name: values.name, states: list }}
            current={list[0]}
            canEdit={false}
            onMove={() => undefined}
          />
        </div>
      )}
    </FormShell>
  )
}
