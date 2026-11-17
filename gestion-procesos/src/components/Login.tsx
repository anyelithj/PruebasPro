import { Form as FormikForm, Formik } from 'formik'
import { useState } from 'react'
import { Alert, Button } from 'react-bootstrap'
import { FcGoogle } from 'react-icons/fc'
import { Link } from 'react-router-dom'
import * as Yup from 'yup'
import { useAuth } from '../hooks/useAuth'
import '../styles/StyleLogin.scss'
import Seo from './accesories/Seo'
import TextField from './Register/TextField'

const schema = Yup.object({
  email: Yup.string().email('Escribe un correo válido').required('El correo es obligatorio'),
  password: Yup.string().required('La contraseña es obligatoria'),
})

export default function Login() {
  const { login, loginWithGoogle, resetPassword } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const handleReset = async (email: string) => {
    if (!email) return setError('Escribe tu correo arriba y vuelve a pulsar «Olvidé mi contraseña».')
    const err = await resetPassword(email)
    if (err) setError(err)
    else {
      setError(null)
      setInfo('Te enviamos un correo para restablecer tu contraseña.')
    }
  }

  return (
    <main id="contenido" className="l-auth" tabIndex={-1}>
      <Seo title="Iniciar sesión" description="Accede a tu espacio de gestión de procesos y tareas." />
      <section className="auth-card" aria-labelledby="login-title">
        <h1 id="login-title" className="h3">
          Inicia sesión
        </h1>
        <p className="text-secondary">Continúa donde dejaste tus procesos.</p>

        {error && (
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        )}
        {info && (
          <Alert variant="success" role="status">
            {info}
          </Alert>
        )}

        <Formik
          initialValues={{ email: '', password: '' }}
          validationSchema={schema}
          onSubmit={async (values, { setSubmitting }) => {
            setInfo(null)
            setError(await login(values.email, values.password))
            setSubmitting(false)
          }}
        >
          {({ isSubmitting, values }) => (
            <FormikForm noValidate>
              <TextField name="email" label="Correo electrónico" type="email" autoComplete="email" />
              <TextField name="password" label="Contraseña" type="password" autoComplete="current-password" />
              <Button type="submit" className="w-100" disabled={isSubmitting}>
                {isSubmitting ? 'Entrando…' : 'Entrar'}
              </Button>
              <Button type="button" variant="link" className="px-0 mt-2" onClick={() => handleReset(values.email)}>
                Olvidé mi contraseña
              </Button>
            </FormikForm>
          )}
        </Formik>

        <div className="auth-divider" role="separator">
          <span>o</span>
        </div>
        <Button variant="outline-secondary" className="w-100" onClick={async () => setError(await loginWithGoogle())}>
          <FcGoogle aria-hidden="true" /> Continuar con Google
        </Button>
        <p className="mt-4 mb-0">
          ¿No tienes cuenta? <Link to="/registro">Regístrate</Link>
        </p>
      </section>
    </main>
  )
}
