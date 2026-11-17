import { useAuth } from '../../hooks/useAuth'
import { useProcesses } from '../../hooks/useProcesses'
import { useUsers } from '../../hooks/useUsers'
import { confirmDelete, showError } from '../helpers/confirm'
import '../../styles/StyleAssignedProcesses.scss'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import Spinner from '../accesories/Spinner'
import ProcessInformation from '../ProcessInformation'

export default function AssignedProcesses() {
  const { user } = useAuth()
  const { processes, loading, remove } = useProcesses()
  const { nameOf } = useUsers()
  const mine = processes.filter((p) => user && (p.assigneeIds.includes(user.uid) || p.ownerId === user.uid))

  const handleDelete = async (p: { id: string; title: string }) => {
    if (await confirmDelete(`¿Eliminar «${p.title}»?`, 'También se eliminarán sus tareas y archivos.'))
      await remove(p.id).catch(showError)
  }

  return (
    <>
      <Seo title="Mis procesos" noIndex />
      <PageHeader
        title="Asignados a mí"
        subtitle="Procesos que creaste o en los que eres responsable."
        back={{ to: '/app/procesos', label: 'Procesos activos' }}
      />
      {loading ? (
        <Spinner />
      ) : mine.length === 0 ? (
        <p className="empty-state">No tienes procesos asignados por ahora.</p>
      ) : (
        <div className="l-stack">
          {mine.map((p) => (
            <ProcessInformation key={p.id} process={p} ownerName={nameOf(p.ownerId)} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </>
  )
}
