// ProtectedRoute.tsx — RUTA PROTEGIDA: además de tener sesión, exige un PERMISO según el rol (RBAC).
// Ejemplo en DashboardRoutes: <ProtectedRoute permission="users:manage"><UserManagement /></ProtectedRoute>

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/accesories/Seo'
import { useAuth } from '../hooks/useAuth'
// `Permission`: tipo unión con los permisos válidos; escribir uno inexistente da error de compilación.
import type { Permission } from '../services/permissions'

/** Ruta protegida: además de sesión, exige un permiso según el rol del usuario. */
export default function ProtectedRoute({ permission, children }: { permission: Permission; children: ReactNode }) {
  // `can(permiso)`: consulta la matriz de roles del usuario actual.
  const { can } = useAuth()
  // Con permiso: muestra la pantalla pedida.
  if (can(permission)) return <>{children}</>
  // Sin permiso: aviso accesible. `role="alert"` hace que los lectores de pantalla lo anuncien al aparecer.
  return (
    <div role="alert" className="alert alert-warning">
      {/* Etiqueta SEO: título de la pestaña y `noindex` para que los buscadores no indexen la página. */}
      <Seo title="Acceso restringido" noIndex />
      <h1 className="h5">No tienes permiso para ver esta sección</h1>
      <p className="mb-2">Pide a un administrador que revise tu rol.</p>
      {/* `Link`: navegación interna sin recargar la página (SPA). */}
      <Link to="/app">Volver al inicio</Link>
    </div>
  )
}
