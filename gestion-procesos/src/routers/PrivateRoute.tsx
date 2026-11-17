// ═══════════════════════════════════════════════════════════════════════════════════════
// PrivateRoute.tsx — RUTA PRIVADA: solo deja pasar a quien tiene sesión iniciada.
// Patrón de React: COMPOSITION (composición): envuelve a otros componentes (`children`) en vez de heredar de ellos.
// ═══════════════════════════════════════════════════════════════════════════════════════

// `ReactNode`: tipo de TypeScript para «cualquier cosa que React pueda dibujar» (elementos, texto, null…).
import type { ReactNode } from 'react'
// `Navigate`: componente que redirige. `useLocation`: hook que dice en qué URL estamos.
import { Navigate, useLocation } from 'react-router-dom'
import Spinner from '../components/accesories/Spinner'
import { useAuth } from '../hooks/useAuth'

/** Ruta privada: requiere sesión iniciada. */
// `{ children }: { children: ReactNode }`: desestructura las props y las tipa. `children` = lo que se escribe entre las etiquetas.
export default function PrivateRoute({ children }: { children: ReactNode }) {
  // `user`: usuario autenticado o null. `checking`: true mientras Firebase verifica si hay sesión guardada.
  const { user, checking } = useAuth()
  // Ruta actual: se guarda para volver a ella después de iniciar sesión.
  const location = useLocation()
  // Renderizado condicional con `if`: mientras se verifica, muestra un indicador (evita un redireccionamiento falso al login).
  if (checking) return <Spinner label="Verificando sesión" />
  // Operador ternario: con usuario → muestra el contenido; sin usuario → redirige a /login.
  // `replace`: reemplaza la entrada del historial (el botón «atrás» no vuelve a la ruta bloqueada). `state`: dato que viaja con la redirección.
  return user ? <>{children}</> : <Navigate to="/login" replace state={{ from: location.pathname }} />
}
