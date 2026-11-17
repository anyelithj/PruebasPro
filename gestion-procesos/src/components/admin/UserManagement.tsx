import { Badge, Button } from 'react-bootstrap'
import { FiPlus } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useUsers } from '../../hooks/useUsers'
import { ROLES, ROLE_LABEL } from '../../models'
import { ALL_PERMISSIONS, PERMISSION_LABEL, ROLE_PERMISSIONS } from '../../services/permissions'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import Spinner from '../accesories/Spinner'
import { confirmDelete, showError } from '../helpers/confirm'

export default function UserManagement() {
  const { users, loading, remove } = useUsers()
  const { user: me } = useAuth()
  return (
    <>
      <Seo title="Usuarios y roles" noIndex />
      <PageHeader
        title="Usuarios y roles"
        subtitle="Crea, edita, desactiva y elimina usuarios. Solo los administradores pueden hacerlo."
        actions={
          <Link to="/app/usuarios/nuevo" className="btn btn-primary">
            <FiPlus aria-hidden="true" /> Nuevo usuario
          </Link>
        }
      />
      {loading ? (
        <Spinner />
      ) : (
        <div className="table-responsive">
          <table className="table align-middle">
            <caption className="visually-hidden">Lista de usuarios</caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Correo</th>
                <th scope="col">Rol</th>
                <th scope="col">Cargo</th>
                <th scope="col">Cuenta</th>
                <th scope="col">
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid}>
                  <td>
                    <Link to={`/app/usuarios/${u.uid}`}>{u.displayName || '—'}</Link>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <Badge bg="primary">{ROLE_LABEL[u.role]}</Badge>
                  </td>
                  <td>{u.position || '—'}</td>
                  <td>{u.active ? 'Activa' : <Badge bg="secondary">Desactivada</Badge>}</td>
                  <td className="text-nowrap">
                    <Link to={`/app/usuarios/${u.uid}`} className="btn btn-sm btn-outline-primary me-1">
                      Ver
                    </Link>
                    <Link to={`/app/usuarios/${u.uid}/editar`} className="btn btn-sm btn-outline-secondary me-1">
                      Editar
                    </Link>
                    {u.uid !== me?.uid && (
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={async () => {
                          if (
                            await confirmDelete(
                              `¿Eliminar el perfil de ${u.displayName}?`,
                              'Su cuenta de acceso sigue existiendo; para bloquearla usa «Desactivar» al editar.',
                            )
                          )
                            await remove(u).catch(showError)
                        }}
                      >
                        Eliminar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <details className="detail-block">
        <summary className="fw-bold">Permisos por rol</summary>
        <div className="table-responsive mt-3">
          <table className="table table-sm mb-0">
            <caption className="visually-hidden">Matriz de permisos por rol</caption>
            <thead>
              <tr>
                <th scope="col">Permiso</th>
                {ROLES.map((r) => (
                  <th key={r} scope="col">
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_PERMISSIONS.map((p) => (
                <tr key={p}>
                  <th scope="row">{PERMISSION_LABEL[p]}</th>
                  {ROLES.map((r) => (
                    <td key={r}>
                      {ROLE_PERMISSIONS[r].includes(p) ? (
                        <span aria-label="Sí">✔</span>
                      ) : (
                        <span aria-label="No" className="text-secondary">
                          —
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  )
}
