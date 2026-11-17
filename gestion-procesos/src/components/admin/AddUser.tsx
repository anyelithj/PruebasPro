import { useNavigate } from 'react-router-dom'
import { useUsers } from '../../hooks/useUsers'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import UserForm from './UserForm'

export default function AddUser() {
  const { add } = useUsers()
  const navigate = useNavigate()
  return (
    <>
      <Seo title="Nuevo usuario" noIndex />
      <PageHeader
        title="Nuevo usuario"
        subtitle="Crea la cuenta de acceso y asigna su rol."
        back={{ to: '/app/usuarios', label: 'Usuarios' }}
      />
      <div className="form-panel">
        <UserForm
          mode="create"
          onSubmit={async (v) => {
            const uid = await add({
              displayName: v.displayName,
              email: v.email,
              password: v.password,
              role: v.role,
              position: v.position,
            })
            navigate(`/app/usuarios/${uid}`)
          }}
        />
      </div>
    </>
  )
}
