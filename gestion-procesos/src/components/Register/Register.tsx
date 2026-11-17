import { Button } from 'react-bootstrap'
import { FcGoogle } from 'react-icons/fc'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import '../../styles/StyleRegister.scss'
import Seo from '../accesories/Seo'
import SingUp from './SingUp'

export default function Register() {
  const { loginWithGoogle } = useAuth()
  return (
    <main id="contenido" className="l-auth" tabIndex={-1}>
      <Seo title="Crear cuenta" description="Crea tu cuenta para gestionar procesos, tareas y flujos de trabajo." />
      <section className="auth-card" aria-labelledby="register-title">
        <h1 id="register-title" className="h3">
          Crea tu cuenta
        </h1>
        <p className="text-secondary">Empieza con el rol de miembro. Un administrador puede cambiarlo después.</p>
        <SingUp />
        <div className="auth-divider" role="separator">
          <span>o</span>
        </div>
        <Button variant="outline-secondary" className="w-100" onClick={() => loginWithGoogle()}>
          <FcGoogle aria-hidden="true" /> Registrarme con Google
        </Button>
        <p className="mt-4 mb-0">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </section>
    </main>
  )
}
