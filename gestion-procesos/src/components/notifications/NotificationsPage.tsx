import { Badge, Button } from 'react-bootstrap'
import { FiTrash2 } from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'
import { useNotifications } from '../../hooks/useNotifications'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import { formatDate } from '../helpers/ConvertirId'

export default function NotificationsPage() {
  const { notifications, alerts, unread, markRead, markAllRead, remove } = useNotifications()
  const navigate = useNavigate()
  return (
    <>
      <Seo title="Notificaciones" noIndex />
      <PageHeader
        title="Notificaciones y alertas"
        actions={
          unread > 0 && (
            <Button variant="outline-primary" onClick={() => markAllRead()}>
              Marcar todo como leído
            </Button>
          )
        }
      />

      <section aria-labelledby="alertas" className="detail-block">
        <h2 id="alertas" className="h5">
          Alertas de fechas límite
        </h2>
        {alerts.length === 0 ? (
          <p className="text-secondary mb-0">No tienes vencidos ni próximos a vencer.</p>
        ) : (
          <ul className="row-list mt-0">
            {alerts.map((a) => (
              <li key={a.key} className="row-list__item">
                <div>
                  <Link to={a.link} className="fw-bold">
                    {a.title}
                  </Link>
                  <div className="small text-secondary">
                    {a.type === 'proceso' ? 'Proceso' : 'Tarea'} · {formatDate(a.dueDate)}
                  </div>
                </div>
                <Badge
                  bg={a.kind === 'overdue' ? 'danger' : 'warning'}
                  text={a.kind === 'overdue' ? undefined : 'dark'}
                >
                  {a.kind === 'overdue' ? 'Vencido' : 'Por vencer'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="avisos" className="detail-block">
        <h2 id="avisos" className="h5">
          Avisos
        </h2>
        {notifications.length === 0 ? (
          <p className="text-secondary mb-0">No tienes avisos.</p>
        ) : (
          <ul className="row-list mt-0">
            {notifications.map((n) => (
              <li key={n.id} className="row-list__item">
                <div className={n.read ? 'is-read' : 'is-unread'}>
                  {n.message}
                  <div className="small text-secondary fw-normal">
                    {new Date(n.createdAt).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </div>
                <div className="row-list__actions">
                  {n.link && (
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={() => {
                        markRead(n.id)
                        navigate(n.link)
                      }}
                    >
                      Abrir
                    </Button>
                  )}
                  {!n.read && (
                    <Button size="sm" variant="outline-secondary" onClick={() => markRead(n.id)}>
                      Marcar leído
                    </Button>
                  )}
                  <Button size="sm" variant="outline-danger" onClick={() => remove(n.id)} aria-label="Eliminar aviso">
                    <FiTrash2 aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
