import { Form as FormikForm, Formik } from 'formik'
import { Alert, Button } from 'react-bootstrap'
import * as Yup from 'yup'
import { useAuth } from '../../hooks/useAuth'
import TextField from './TextField'

const schema = Yup.object({
  name: Yup.string().trim().min(2, 'Escribe tu nombre').required('El nombre es obligatorio'),
  email: Yup.string().email('Escribe un correo válido').required('El correo es obligatorio'),
  password: Yup.string().min(6, 'Usa al menos 6 caracteres').required('La contraseña es obligatoria'),
  confirm: Yup.string()
    .oneOf([Yup.ref('password')], 'Las contraseñas no coinciden')
    .required('Confirma tu contraseña'),
})

export default function SingUp() {
  const { signUp, register } = useAuth()
  return (
    <>
      {register.error && (
        <Alert variant="danger" role="alert">
          {register.error}
        </Alert>
      )}
      <Formik
        initialValues={{ name: '', email: '', password: '', confirm: '' }}
        validationSchema={schema}
        onSubmit={(v) => signUp(v.name.trim(), v.email, v.password)}
      >
        <FormikForm noValidate>
          <TextField name="name" label="Nombre completo" autoComplete="name" />
          <TextField name="email" label="Correo electrónico" type="email" autoComplete="email" />
          <TextField name="password" label="Contraseña" type="password" autoComplete="new-password" />
          <TextField name="confirm" label="Confirmar contraseña" type="password" autoComplete="new-password" />
          <Button type="submit" className="w-100" disabled={register.loading}>
            {register.loading ? 'Creando cuenta…' : 'Crear cuenta'}
          </Button>
        </FormikForm>
      </Formik>
    </>
  )
}
