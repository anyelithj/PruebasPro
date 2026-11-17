import { Col, Form, Row } from 'react-bootstrap'
import { useForm } from '../../hooks/useForm'
import { useFormSubmit } from '../../hooks/useFormSubmit'
import { ROLES, ROLE_LABEL, type Role } from '../../models'
import FormShell, { type FormMode } from '../accesories/FormShell'

export interface UserFormValues {
  displayName: string
  email: string
  password: string
  role: Role
  position: string
  active: boolean
}
export const emptyUser: UserFormValues = {
  displayName: '',
  email: '',
  password: '',
  role: 'member',
  position: '',
  active: true,
}

interface Props {
  mode: FormMode
  initial?: UserFormValues
  isSelf?: boolean
  onSubmit?: (v: UserFormValues) => Promise<void>
}

const SUBMIT_LABEL = { create: 'Crear usuario', edit: 'Guardar cambios', view: '' } as const

/** Un solo formulario para crear, editar y ver el detalle de un usuario. */
export default function UserForm({ mode, initial = emptyUser, isSelf = false, onSubmit }: Props) {
  const { values, handleChange, setField } = useForm<UserFormValues>(initial)
  const { saving, error, setError, run } = useFormSubmit('No se pudo guardar.')
  const editable = mode !== 'view'

  const submit = async () => {
    if (values.displayName.trim().length < 2) return setError('Escribe el nombre completo.')
    if (mode === 'create' && (!/^\S+@\S+\.\S+$/.test(values.email) || values.password.length < 6)) {
      return setError('Escribe un correo válido y una contraseña de al menos 6 caracteres.')
    }
    await run(() => onSubmit?.({ ...values, displayName: values.displayName.trim() }))
  }

  return (
    <FormShell
      mode={mode}
      label="Formulario de usuario"
      error={error}
      saving={saving}
      submitLabel={SUBMIT_LABEL[mode]}
      onSubmit={submit}
    >
      <Row className="g-3">
        <Col md={6}>
          <Form.Label htmlFor="u-name">Nombre completo{editable && ' *'}</Form.Label>
          <Form.Control
            id="u-name"
            name="displayName"
            value={values.displayName}
            onChange={handleChange}
            autoComplete="off"
          />
        </Col>
        <Col md={6}>
          <Form.Label htmlFor="u-position">Cargo</Form.Label>
          <Form.Control id="u-position" name="position" value={values.position} onChange={handleChange} />
        </Col>
        <Col md={6}>
          <Form.Label htmlFor="u-email">Correo{editable && ' *'}</Form.Label>
          <Form.Control
            id="u-email"
            type="email"
            name="email"
            value={values.email}
            onChange={handleChange}
            disabled={mode !== 'create'}
            autoComplete="off"
          />
        </Col>
        {mode === 'create' && (
          <Col md={6}>
            <Form.Label htmlFor="u-pass">Contraseña inicial *</Form.Label>
            <Form.Control
              id="u-pass"
              type="password"
              name="password"
              value={values.password}
              onChange={handleChange}
              autoComplete="new-password"
              aria-describedby="u-pass-help"
            />
            <Form.Text id="u-pass-help">La persona podrá cambiarla con «Olvidé mi contraseña».</Form.Text>
          </Col>
        )}
        <Col md={6}>
          <Form.Label htmlFor="u-role">Rol</Form.Label>
          <Form.Select
            id="u-role"
            name="role"
            value={values.role}
            onChange={handleChange}
            disabled={isSelf}
            aria-describedby={isSelf && editable ? 'u-role-help' : undefined}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Form.Select>
          {isSelf && editable && <Form.Text id="u-role-help">No puedes cambiar tu propio rol.</Form.Text>}
        </Col>
        {mode !== 'create' && (
          <Col md={6} className="d-flex align-items-end">
            <Form.Check
              type="switch"
              id="u-active"
              label="Cuenta activa"
              checked={values.active}
              disabled={isSelf}
              onChange={(e) => setField('active', e.target.checked)}
            />
          </Col>
        )}
      </Row>
    </FormShell>
  )
}
