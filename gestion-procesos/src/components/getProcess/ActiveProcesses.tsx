import { useMemo, useState } from 'react'
import { Alert, Form } from 'react-bootstrap'
import { FiPlus } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useDashboard } from '../../hooks/useDashboard'
import { useProcesses } from '../../hooks/useProcesses'
import { useUsers } from '../../hooks/useUsers'
import '../../styles/StyleActiveProcesses.scss'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import Spinner from '../accesories/Spinner'
import { confirmDelete, showError } from '../helpers/confirm'
import ProcessInformation from '../ProcessInformation'

export default function ActiveProcesses() {
  const { processes, loading, error, isFinished, remove } = useProcesses()
  const { nameOf } = useUsers()
  const { can } = useAuth()
  const { progress } = useDashboard()
  const [status, setStatus] = useState('')

  const active = useMemo(() => processes.filter((p) => !isFinished(p)), [processes, isFinished])
  const statuses = useMemo(() => [...new Set(active.map((p) => p.status))], [active])
  const visible = status ? active.filter((p) => p.status === status) : active
  const progressOf = useMemo(() => new Map(progress.map((p) => [p.processId, p.progress])), [progress])

  const handleDelete = async (p: { id: string; title: string }) => {
    if (await confirmDelete(`¿Eliminar «${p.title}»?`, 'También se eliminarán sus tareas y archivos.'))
      await remove(p.id).catch(showError)
  }

  return (
    <>
      <Seo title="Procesos activos" noIndex />
      <PageHeader
        title="Procesos activos"
        subtitle="Procesos y solicitudes que aún no han terminado."
        actions={
          <>
            <Link to="/app/procesos/asignados" className="btn btn-outline-primary">
              Asignados a mí
            </Link>
            <Link to="/app/procesos/buscar" className="btn btn-outline-primary">
              Todos y búsqueda
            </Link>
            {can('process:create') && (
              <Link to="/app/procesos/nuevo" className="btn btn-primary">
                <FiPlus aria-hidden="true" /> Nuevo proceso
              </Link>
            )}
          </>
        }
      />
      {error && <Alert variant="danger">{error}</Alert>}
      <Form.Group className="mb-3 filter-form" controlId="filtro-estado">
        <Form.Label>Filtrar por estado</Form.Label>
        <Form.Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Form.Select>
      </Form.Group>
      {loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <p>No hay procesos activos.</p>
          {can('process:create') && (
            <Link to="/app/procesos/nuevo" className="btn btn-primary">
              Crear el primero
            </Link>
          )}
        </div>
      ) : (
        <div className="l-stack">
          {visible.map((p) => (
            <ProcessInformation
              key={p.id}
              process={p}
              ownerName={nameOf(p.ownerId)}
              progress={progressOf.get(p.id)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </>
  )
}
