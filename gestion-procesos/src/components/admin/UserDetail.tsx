import { Button } from 'react-bootstrap'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useProcesses } from '../../hooks/useProcesses'
import { useTasks } from '../../hooks/useTasks'
import { useUsers } from '../../hooks/useUsers'
import { ROLE_PERMISSIONS, PERMISSION_LABEL } from '../../services/permissions'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import NotFoundNotice from '../accesories/NotFoundNotice'
import Spinner from '../accesories/Spinner'
import { formatDate } from '../helpers/ConvertirId'
import { confirmDelete, showError } from '../helpers/confirm'
import HistoryTimeline from '../history/HistoryTimeline'
import UserForm from './UserForm'

export default function UserDetail() {
  const { uid } = useParams()
  const navigate = useNavigate()
  const { getById, remove, loading } = useUsers()
  const { processes, isFinished } = useProcesses()
  const { tasks } = useTasks()
  const { user: me } = useAuth()
  const user = getById(uid)

  if (loading) return <Spinner />
  if (!user) return <NotFoundNotice what="este usuario" to="/app/usuarios" />

  const myProcesses = processes.filter((p) => p.assigneeIds.includes(user.uid) && !isFinished(p))
  const myTasks = tasks.filter((t) => t.assigneeId === user.uid && t.status !== 'done')

  const handleDelete = async () => {
    if (
      await confirmDelete(
        `¿Eliminar el perfil de ${user.displayName}?`,
        'Su cuenta de acceso sigue existiendo; para bloquearla usa «Desactivar» al editar.',
      )
    ) {
      try {
        await remove(user)
        navigate('/app/usuarios')
      } catch (e) {
        showError(e)
      }
    }
  }

  return (
    <>
      <Seo title={user.displayName ?? 'Usuario'} noIndex />
      <PageHeader
        title={user.displayName || 'Usuario'}
        subtitle={user.email ?? ''}
        back={{ to: '/app/usuarios', label: 'Usuarios' }}
        actions={
          <>
            <Link to={`/app/usuarios/${user.uid}/editar`} className="btn btn-outline-primary">
              Editar
            </Link>
            {user.uid !== me?.uid && (
              <Button variant="outline-danger" onClick={handleDelete}>
                Eliminar
              </Button>
            )}
          </>
        }
      />
      <section className="detail-block" aria-labelledby="u-datos">
        <h2 id="u-datos" className="h5">
          Datos
        </h2>
        <UserForm
          key={`${user.uid}-${user.role}-${user.active}`}
          mode="view"
          isSelf={user.uid === me?.uid}
          initial={{
            displayName: user.displayName ?? '',
            email: user.email ?? '',
            password: '',
            role: user.role,
            position: user.position,
            active: user.active,
          }}
        />
        <dl className="detail-grid mt-3">
          <div>
            <dt>Registrado</dt>
            <dd>{formatDate(user.createdAt)}</dd>
          </div>
          <div>
            <dt>Procesos abiertos</dt>
            <dd>{myProcesses.length}</dd>
          </div>
          <div>
            <dt>Tareas abiertas</dt>
            <dd>{myTasks.length}</dd>
          </div>
        </dl>
        <h3 className="h6 mt-3">Permisos de su rol</h3>
        <ul className="mb-0">
          {ROLE_PERMISSIONS[user.role].map((p) => (
            <li key={p}>{PERMISSION_LABEL[p]}</li>
          ))}
        </ul>
      </section>
      <section className="detail-block" aria-labelledby="u-trabajo">
        <h2 id="u-trabajo" className="h5">
          Trabajo asignado
        </h2>
        {myProcesses.length + myTasks.length === 0 ? (
          <p className="text-secondary mb-0">Sin trabajo abierto.</p>
        ) : (
          <ul className="mb-0">
            {myProcesses.map((p) => (
              <li key={p.id}>
                Proceso: <Link to={`/app/procesos/${p.id}`}>{p.title}</Link> ({p.status})
              </li>
            ))}
            {myTasks.map((t) => (
              <li key={t.id}>
                Tarea: <Link to={`/app/tareas/${t.id}`}>{t.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="detail-block" aria-labelledby="u-hist">
        <h2 id="u-hist" className="h5">
          Actividad reciente
        </h2>
        <HistoryTimeline userId={user.uid} max={20} />
      </section>
    </>
  )
}
