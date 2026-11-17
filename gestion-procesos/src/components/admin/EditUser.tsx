import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useUsers } from '../../hooks/useUsers'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import NotFoundNotice from '../accesories/NotFoundNotice'
import Spinner from '../accesories/Spinner'
import UserForm from './UserForm'

export default function EditUser() {
  const { uid } = useParams()
  const { getById, edit, loading } = useUsers()
  const { user: me } = useAuth()
  const navigate = useNavigate()
  const user = getById(uid)
  if (loading) return <Spinner />
  if (!user) return <NotFoundNotice what="este usuario" to="/app/usuarios" />
  return (
    <>
      <Seo title={`Editar ${user.displayName ?? ''}`} noIndex />
      <PageHeader
        title="Editar usuario"
        back={{ to: `/app/usuarios/${user.uid}`, label: user.displayName || 'Usuario' }}
      />
      <div className="form-panel">
        <UserForm
          mode="edit"
          isSelf={user.uid === me?.uid}
          initial={{
            displayName: user.displayName ?? '',
            email: user.email ?? '',
            password: '',
            role: user.role,
            position: user.position,
            active: user.active,
          }}
          onSubmit={async (v) => {
            await edit(user, { displayName: v.displayName, role: v.role, position: v.position, active: v.active })
            navigate(`/app/usuarios/${user.uid}`)
          }}
        />
      </div>
    </>
  )
}
