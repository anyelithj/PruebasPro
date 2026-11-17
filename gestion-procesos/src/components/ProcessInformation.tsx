import { Badge } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { PRIORITY_LABEL, PRIORITY_VARIANT, type Process } from '../models'
import { formatDate } from './helpers/ConvertirId'

interface Props {
  process: Process
  ownerName?: string
  progress?: number
  onDelete?: (p: Process) => void
}

/** Presentacional: resumen de un proceso con acciones del CRUD según los permisos del rol. */
export default function ProcessInformation({ process, ownerName, progress, onDelete }: Props) {
  const { can } = useAuth()
  return (
    <article className="process-item">
      <h3 className="h6 mb-1">
        <Link to={`/app/procesos/${process.id}`}>{process.title}</Link>
      </h3>
      <p className="text-secondary small mb-2">{process.aiSummary || process.description || 'Sin descripción'}</p>
      <div className="process-item__meta">
        <Badge bg="primary">{process.status}</Badge>
        <Badge bg={PRIORITY_VARIANT[process.priority]} text={process.priority === 'high' ? 'dark' : undefined}>
          Prioridad {PRIORITY_LABEL[process.priority].toLowerCase()}
        </Badge>
        <Badge bg="light" text="dark">
          {process.kind === 'solicitud' ? 'Solicitud' : 'Proceso'}
        </Badge>
        {process.category && (
          <Badge bg="light" text="dark">
            {process.category}
          </Badge>
        )}
        <span className="small text-secondary">Vence: {formatDate(process.dueDate)}</span>
        {ownerName && <span className="small text-secondary">Responsable: {ownerName}</span>}
      </div>
      {progress !== undefined && (
        <div
          className="progress mt-2"
          role="progressbar"
          aria-label={`Avance de ${process.title}`}
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="progress-bar" style={{ width: `${progress}%` }}>
            {progress}%
          </div>
        </div>
      )}
      <div className="process-item__actions">
        <Link to={`/app/procesos/${process.id}`} className="btn btn-sm btn-outline-primary">
          Ver detalle
        </Link>
        {can('process:edit') && (
          <Link to={`/app/procesos/${process.id}/editar`} className="btn btn-sm btn-outline-secondary">
            Editar
          </Link>
        )}
        {can('process:delete') && onDelete && (
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDelete(process)}>
            Eliminar
          </button>
        )}
      </div>
    </article>
  )
}
