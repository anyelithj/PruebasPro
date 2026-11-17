import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import Spinner from '../components/accesories/Spinner'
import { useAuth } from '../hooks/useAuth'

/** Ruta pública (login/registro): si ya hay sesión, redirige al área privada. */
export default function PublicRoute({ children }: { children: ReactNode }) {
  const { user, checking } = useAuth()
  const location = useLocation()
  if (checking) return <Spinner label="Verificando sesión" />
  const from = (location.state as { from?: string } | null)?.from
  return user ? <Navigate to={from ?? '/app'} replace /> : <>{children}</>
}
