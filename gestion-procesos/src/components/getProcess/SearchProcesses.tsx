import { useMemo, useState } from 'react'
import { Button } from 'react-bootstrap'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useDashboard } from '../../hooks/useDashboard'
import { useProcesses } from '../../hooks/useProcesses'
import { useUsers } from '../../hooks/useUsers'
import { emptyProcessFilters, filterProcesses, type ProcessFilters } from '../../services/filters'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import Spinner from '../accesories/Spinner'
import { confirmDelete, showError } from '../helpers/confirm'
import ProcessInformation from '../ProcessInformation'
import ProcessFilterBar from './ProcessFilterBar'

/** Listado completo de procesos con búsqueda y filtros avanzados. */
export default function SearchProcesses() {
  const [params] = useSearchParams()
  const { processes, loading, remove, isFinished } = useProcesses()
  const { nameOf } = useUsers()
  const { can } = useAuth()
  const { progress } = useDashboard()
  const [filters, setFilters] = useState<ProcessFilters>({
    ...emptyProcessFilters,
    overdueOnly: params.get('vencidos') === '1',
  })

  const results = useMemo(() => filterProcesses(processes, filters, isFinished), [processes, filters, isFinished])
  const progressOf = useMemo(() => new Map(progress.map((p) => [p.processId, p.progress])), [progress])

  const handleDelete = async (p: { id: string; title: string }) => {
    if (await confirmDelete(`¿Eliminar «${p.title}»?`, 'También se eliminarán sus tareas y archivos.'))
      await remove(p.id).catch(showError)
  }

  return (
    <>
      <Seo title="Todos los procesos" noIndex />
      <PageHeader
        title="Todos los procesos"
        subtitle="Busca y filtra procesos y solicitudes."
        actions={
          can('process:create') && (
            <Link to="/app/procesos/nuevo" className="btn btn-primary">
              Nuevo proceso
            </Link>
          )
        }
      />
      <ProcessFilterBar value={filters} onChange={setFilters} processes={processes} />
      <p aria-live="polite" className="text-secondary my-3">
        {results.length} resultado(s){' '}
        <Button variant="link" size="sm" onClick={() => setFilters(emptyProcessFilters)}>
          Limpiar filtros
        </Button>
      </p>
      {loading ? (
        <Spinner />
      ) : results.length === 0 ? (
        <p className="empty-state">Ningún proceso coincide con los filtros.</p>
      ) : (
        <div className="l-stack">
          {results.map((p) => (
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
