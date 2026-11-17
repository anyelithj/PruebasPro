import { env } from '../config/env'
import { Badge, Dropdown } from 'react-bootstrap'
import { FiBell, FiLogOut, FiMenu, FiUser } from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { useUserPerfil } from '../hooks/UserPerfil'
import '../styles/NavBar.scss'
import { formatTime } from './helpers/ConvertirId'

export default function NavBar({ onToggleMenu }: { onToggleMenu: () => void }) {
  const { logout } = useAuth()
  const { name, initials, roleLabel } = useUserPerfil()
  const { notifications, unread, markRead, markAllRead } = useNotifications()
  const navigate = useNavigate()

  return (
    <header className="top-bar">
      <button type="button" className="top-bar__menu d-lg-none" onClick={onToggleMenu} aria-label="Abrir menú">
        <FiMenu aria-hidden="true" />
      </button>
      <Link to="/app" className="top-bar__brand">
        {env.appName}
      </Link>

      <div className="top-bar__actions">
        <Dropdown align="end">
          <Dropdown.Toggle
            variant="link"
            className="top-bar__icon-btn"
            aria-label={`Notificaciones, ${unread} sin leer`}
          >
            <FiBell aria-hidden="true" />
            {unread > 0 && (
              <Badge bg="danger" pill className="top-bar__badge">
                {unread}
              </Badge>
            )}
          </Dropdown.Toggle>
          <Dropdown.Menu className="top-bar__notifications">
            <Dropdown.Header>Notificaciones</Dropdown.Header>
            {notifications.length === 0 && (
              <Dropdown.ItemText className="text-secondary">Todo al día. No tienes avisos nuevos.</Dropdown.ItemText>
            )}
            {notifications.slice(0, 8).map((n) => (
              <Dropdown.Item
                key={n.id}
                className={n.read ? 'is-read' : 'is-unread'}
                onClick={() => {
                  markRead(n.id)
                  if (n.link) navigate(n.link)
                }}
              >
                <span className="d-block text-wrap">{n.message}</span>
                <small>{formatTime(n.createdAt)}</small>
              </Dropdown.Item>
            ))}
            {unread > 0 && (
              <Dropdown.Item as="button" onClick={() => markAllRead()}>
                Marcar todo como leído
              </Dropdown.Item>
            )}
          </Dropdown.Menu>
        </Dropdown>

        <Dropdown align="end">
          <Dropdown.Toggle variant="link" className="top-bar__user" aria-label={`Cuenta de ${name}`}>
            <span className="top-bar__avatar" aria-hidden="true">
              {initials}
            </span>
            <span className="d-none d-md-inline">{name}</span>
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.ItemText className="small text-secondary">{roleLabel}</Dropdown.ItemText>
            <Dropdown.Item as={Link} to="/app/perfil">
              <FiUser aria-hidden="true" /> Mi perfil
            </Dropdown.Item>
            <Dropdown.Item as="button" onClick={() => logout()}>
              <FiLogOut aria-hidden="true" /> Cerrar sesión
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </header>
  )
}
