import { useField } from 'formik'
import { Form } from 'react-bootstrap'

interface TextFieldProps {
  name: string
  label: string
  type?: string
  autoComplete?: string
  placeholder?: string
}

/** Campo de Formik accesible: etiqueta asociada y error vinculado con aria-describedby. */
export default function TextField({ label, ...props }: TextFieldProps) {
  const [field, meta] = useField(props.name)
  const invalid = meta.touched && !!meta.error
  const id = `campo-${props.name}`
  return (
    <Form.Group className="mb-3" controlId={id}>
      <Form.Label>{label}</Form.Label>
      <Form.Control {...field} {...props} isInvalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} />
      <Form.Control.Feedback type="invalid" id={`${id}-error`}>
        {meta.error}
      </Form.Control.Feedback>
    </Form.Group>
  )
}
