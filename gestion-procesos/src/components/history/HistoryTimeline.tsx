import { Badge } from 'react-bootstrap'
import { useHistory } from '../../hooks/useHistory'
import { HISTORY_ACTION_LABEL } from '../../models'
import Spinner from '../accesories/Spinner'

interface Props {
  entityId?: string
  userId?: string
  max?: number
}

/** Línea de tiempo de cambios de una entidad, de un usuario o global. */
export default function HistoryTimeline({ entityId, userId, max = 50 }: Props) {
  const { entries, loading } = useHistory({ entityId, userId, max })
  if (loading) return <Spinner />
  if (entries.length === 0) return <p className="text-secondary mb-0">Aún no hay cambios registrados.</p>
  return (
    <ol className="timeline">
      {entries.map((e) => (
        <li key={e.id}>
          <div className="timeline__head">
            <Badge bg="light" text="dark">
              {HISTORY_ACTION_LABEL[e.action]}
            </Badge>
            <strong>{e.userName}</strong>
            <time dateTime={new Date(e.createdAt).toISOString()} className="text-secondary small">
              {new Date(e.createdAt).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}
            </time>
          </div>
          <p className="mb-0">
            {!entityId && <strong>{e.entityTitle}: </strong>}
            {e.summary}
          </p>
        </li>
      ))}
    </ol>
  )
}
