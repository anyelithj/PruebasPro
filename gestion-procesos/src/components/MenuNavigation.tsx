import { useState } from 'react'
import type { IconType } from 'react-icons'
import {
  FiBarChart2,
  FiBell,
  FiCalendar,
  FiCheckSquare,
  FiChevronDown,
  FiClock,
  FiColumns,
  FiCpu,
  FiFileText,
  FiFolder,
  FiGitBranch,
  FiHome,
  FiLayers,
  FiMessageSquare,
  FiTrendingUp,
  FiUser,
  FiUsers,
  FiZap,
} from 'react-icons/fi'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { Permission } from '../services/permissions'
import '../styles/MenuNavigation.scss'

interface Item {
  to: string
  label: string
  icon: IconType
  end?: boolean
  permission?: Permission
}

// Agrupado por intención: lo personal arriba, administración, trabajo diario, colaboración, análisis y automatización.
const GROUPS: { title?: string; items: Item[] }[] = [
  {
    items: [
      { to: '/app/perfil', label: 'Mi perfil', icon: FiUser },
      { to: '/app', label: 'Inicio', icon: FiHome, end: true },
      { to: '/app/notificaciones', label: 'Notificaciones', icon: FiBell },
    ],
  },
  {
    title: 'Administración',
    items: [{ to: '/app/usuarios', label: 'Usuarios y roles', icon: FiUsers, permission: 'users:manage' }],
  },
  {
    title: 'Trabajo',
    items: [
      { to: '/app/procesos', label: 'Procesos', icon: FiLayers },
      { to: '/app/tareas', label: 'Tareas', icon: FiCheckSquare },
      { to: '/app/kanban', label: 'Tablero Kanban', icon: FiColumns },
      { to: '/app/calendario', label: 'Calendario', icon: FiCalendar },
      { to: '/app/documentos', label: 'Documentos', icon: FiFolder },
    ],
  },
  {
    title: 'Colaboración',
    items: [
      { to: '/app/chat', label: 'Chat', icon: FiMessageSquare },
      { to: '/app/ia', label: 'Asistente IA', icon: FiCpu, permission: 'ai:use' },
    ],
  },
  {
    title: 'Análisis',
    items: [
      { to: '/app/dashboard', label: 'Indicadores', icon: FiBarChart2, permission: 'dashboard:view' },
      { to: '/app/analitica', label: 'Analítica', icon: FiTrendingUp, permission: 'dashboard:view' },
      { to: '/app/reportes', label: 'Reportes', icon: FiFileText, permission: 'report:view' },
      { to: '/app/historial', label: 'Historial', icon: FiClock, permission: 'history:view' },
    ],
  },
  {
    title: 'Automatización',
    items: [
      { to: '/app/workflows', label: 'Workflows', icon: FiGitBranch, permission: 'workflow:view' },
      { to: '/app/automatizaciones', label: 'Automatizaciones', icon: FiZap, permission: 'automation:manage' },
    ],
  },
]

export default function MenuNavigation({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const { can } = useAuth()
  // Grupos plegados (desplegables). Todos abiertos al inicio.
  const [closed, setClosed] = useState<Set<string>>(() => new Set())
  const toggle = (t: string) =>
    setClosed((prev) => {
      const next = new Set(prev)
      if (!next.delete(t)) next.add(t)
      return next
    })

  return (
    <nav className="menu-nav" aria-label="Secciones">
      {GROUPS.map(({ title, items }) => {
        const visible = items.filter((i) => !i.permission || can(i.permission))
        if (!visible.length) return null
        // Con el menú en modo iconos no hay desplegables: se ven todos.
        const isClosed = !collapsed && !!title && closed.has(title)
        return (
          <div key={title ?? 'personal'} className="menu-nav__group">
            {title && (
              <button
                type="button"
                className="menu-nav__title"
                aria-expanded={!isClosed}
                onClick={() => toggle(title)}
                tabIndex={collapsed ? -1 : undefined}
              >
                {title}
                <FiChevronDown aria-hidden="true" />
              </button>
            )}
            <ul className="menu-nav__list" hidden={isClosed}>
              {visible.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    className="menu-nav__link"
                    title={collapsed ? label : undefined}
                  >
                    <Icon aria-hidden="true" />
                    <span className="menu-nav__label">{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}
