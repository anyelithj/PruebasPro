import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useDashboard } from '../../hooks/useDashboard'
import { useUserPerfil } from '../../hooks/UserPerfil'
import '../../styles/styleinitmenu.scss'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'

export default function InitialMenu() {
  const { name } = useUserPerfil()
  const { can } = useAuth()
  const stats = useDashboard()
  const overdue = stats.overdueProcesses + stats.overdueTasks

  const shortcuts = [
    { to: '/app/procesos/nuevo', label: 'Crear un proceso', show: can('process:create') },
    { to: '/app/procesos/asignados', label: 'Ver mis procesos', show: true },
    { to: '/app/kanban', label: 'Abrir el tablero', show: true },
    { to: '/app/calendario', label: 'Revisar la agenda', show: true },
    { to: '/app/reportes', label: 'Descargar reportes', show: can('report:view') },
    { to: '/app/chat', label: 'Ir al chat', show: true },
  ].filter((s) => s.show)

  return (
    <>
      <Seo title="Inicio" noIndex />
      <PageHeader title={`Hola, ${name}`} subtitle="Esto es lo que hay en tu espacio hoy." />
      <dl className="summary">
        <div>
          <dt>Procesos activos</dt>
          <dd>{stats.activeProcesses}</dd>
        </div>
        <div>
          <dt>Tareas abiertas</dt>
          <dd>{stats.openTasks}</dd>
        </div>
        <div className={overdue ? 'is-alert' : undefined}>
          <dt>Vencidos</dt>
          <dd>{overdue}</dd>
        </div>
        <div>
          <dt>Tareas hechas</dt>
          <dd>{stats.taskCompletionRate}%</dd>
        </div>
      </dl>
      <h2 className="h5 mt-4">Accesos rápidos</h2>
      <ul className="shortcuts">
        {shortcuts.map((s) => (
          <li key={s.to}>
            <Link to={s.to}>{s.label}</Link>
          </li>
        ))}
      </ul>
    </>
  )
}
