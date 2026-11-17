import { lazy, Suspense, useState } from 'react'
import { Offcanvas } from 'react-bootstrap'
import { FiSidebar } from 'react-icons/fi'
import { Navigate, Route, Routes } from 'react-router-dom'
import DataErrorBanner from '../components/accesories/DataErrorBanner'
import ProfileLoadError from '../components/accesories/ProfileLoadError'
import Spinner from '../components/accesories/Spinner'
import MenuNavigation from '../components/MenuNavigation'
import NavBar from '../components/NavBar'
import { useAuth } from '../hooks/useAuth'
import { useDataSync } from '../hooks/useDataSync'
import ProtectedRoute from './ProtectedRoute'

const InitialMenu = lazy(() => import('../components/menuinicial/InitialMenu'))
const ActiveProcesses = lazy(() => import('../components/getProcess/ActiveProcesses'))
const AssignedProcesses = lazy(() => import('../components/getProcess/AssignedProcesses'))
const SearchProcesses = lazy(() => import('../components/getProcess/SearchProcesses'))
const DetailProcess = lazy(() => import('../components/getProcess/DetailProcess'))
const EditProcesses = lazy(() => import('../components/getProcess/EditProcesses'))
const AddProcess = lazy(() => import('../components/uploadProcess/AddProcess'))
const TaskList = lazy(() => import('../components/tasks/TaskList'))
const KanbanBoard = lazy(() => import('../components/kanban/KanbanBoard'))
const CalendarView = lazy(() => import('../components/calendar/CalendarView'))
const Dashboard = lazy(() => import('../components/dashboard/Dashboard'))
const Analytics = lazy(() => import('../components/dashboard/Analytics'))
const CanalRoute = lazy(() => import('../components/chat/CanalRoute'))
const AutomationRules = lazy(() => import('../components/automation/AutomationRules'))
const WorkflowManager = lazy(() => import('../components/workflow/WorkflowManager'))
const UserManagement = lazy(() => import('../components/admin/UserManagement'))
const AIAssistant = lazy(() => import('../components/ai/AIAssistant'))
const Profile = lazy(() => import('../components/Profile'))
const AddTask = lazy(() => import('../components/tasks/AddTask'))
const EditTask = lazy(() => import('../components/tasks/EditTask'))
const TaskDetail = lazy(() => import('../components/tasks/TaskDetail'))
const WorkflowEditor = lazy(() => import('../components/workflow/WorkflowEditor'))
const WorkflowDetail = lazy(() => import('../components/workflow/WorkflowDetail'))
const AddUser = lazy(() => import('../components/admin/AddUser'))
const EditUser = lazy(() => import('../components/admin/EditUser'))
const UserDetail = lazy(() => import('../components/admin/UserDetail'))
const ReportsPage = lazy(() => import('../components/reports/ReportsPage'))
const HistoryPage = lazy(() => import('../components/history/HistoryPage'))
const NotificationsPage = lazy(() => import('../components/notifications/NotificationsPage'))
const DocumentsPage = lazy(() => import('../components/files/DocumentsPage'))

/** Área privada: layout (barra superior + menú lateral) y rutas hijas. */
export default function DashboardRoutes() {
  const [showMenu, setShowMenu] = useState(false)
  // Menú de escritorio plegable (solo iconos), recordado por navegador.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar-collapsed') === '1'
    } catch {
      return false
    }
  })
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('sidebar-collapsed', c ? '0' : '1')
      } catch {
        /* sin almacenamiento: solo dura la sesión */
      }
      return !c
    })
  }
  useDataSync() // una sola suscripción por colección para toda el área privada
  const { user, profile, error, reloadProfile, logout } = useAuth()

  // Hay sesión pero no se pudo cargar el perfil: sin rol no hay permisos. Se explica el motivo en vez de ocultar todo en silencio.
  if (user && !profile)
    return <ProfileLoadError message={error} onRetry={() => reloadProfile()} onLogout={() => logout()} />

  return (
    <div className={`l-shell${collapsed ? ' is-collapsed' : ''}`}>
      <NavBar onToggleMenu={() => setShowMenu(true)} />
      <aside className="l-shell__aside d-none d-lg-block" aria-label="Menú principal">
        <button
          type="button"
          className="menu-nav__toggle"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          title={collapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          <FiSidebar aria-hidden="true" />
        </button>
        <MenuNavigation collapsed={collapsed} />
      </aside>
      <Offcanvas
        show={showMenu}
        onHide={() => setShowMenu(false)}
        responsive="lg"
        className="shell-drawer"
        aria-label="Menú principal"
      >
        <Offcanvas.Header closeButton closeVariant="white">
          <Offcanvas.Title>Menú</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="d-lg-none p-0">
          <MenuNavigation onNavigate={() => setShowMenu(false)} />
        </Offcanvas.Body>
      </Offcanvas>

      <main id="contenido" className="l-shell__main" tabIndex={-1}>
        <DataErrorBanner />
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route index element={<InitialMenu />} />
            <Route path="procesos" element={<ActiveProcesses />} />
            <Route path="procesos/asignados" element={<AssignedProcesses />} />
            <Route path="procesos/buscar" element={<SearchProcesses />} />
            <Route
              path="procesos/nuevo"
              element={
                <ProtectedRoute permission="process:create">
                  <AddProcess />
                </ProtectedRoute>
              }
            />
            <Route path="procesos/:id" element={<DetailProcess />} />
            <Route
              path="procesos/:id/editar"
              element={
                <ProtectedRoute permission="process:edit">
                  <EditProcesses />
                </ProtectedRoute>
              }
            />
            <Route path="tareas" element={<TaskList />} />
            <Route
              path="tareas/nueva"
              element={
                <ProtectedRoute permission="task:create">
                  <AddTask />
                </ProtectedRoute>
              }
            />
            <Route path="tareas/:id" element={<TaskDetail />} />
            <Route
              path="tareas/:id/editar"
              element={
                <ProtectedRoute permission="task:edit">
                  <EditTask />
                </ProtectedRoute>
              }
            />
            <Route path="kanban" element={<KanbanBoard />} />
            <Route path="calendario" element={<CalendarView />} />
            <Route
              path="dashboard"
              element={
                <ProtectedRoute permission="dashboard:view">
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="analitica"
              element={
                <ProtectedRoute permission="dashboard:view">
                  <Analytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="reportes"
              element={
                <ProtectedRoute permission="report:view">
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route path="documentos" element={<DocumentsPage />} />
            <Route
              path="historial"
              element={
                <ProtectedRoute permission="history:view">
                  <HistoryPage />
                </ProtectedRoute>
              }
            />
            <Route path="notificaciones" element={<NotificationsPage />} />
            <Route path="chat" element={<CanalRoute />} />
            <Route path="chat/:canalId" element={<CanalRoute />} />
            <Route
              path="ia"
              element={
                <ProtectedRoute permission="ai:use">
                  <AIAssistant />
                </ProtectedRoute>
              }
            />
            <Route
              path="automatizaciones"
              element={
                <ProtectedRoute permission="automation:manage">
                  <AutomationRules />
                </ProtectedRoute>
              }
            />
            <Route
              path="workflows"
              element={
                <ProtectedRoute permission="workflow:view">
                  <WorkflowManager />
                </ProtectedRoute>
              }
            />
            <Route
              path="workflows/nuevo"
              element={
                <ProtectedRoute permission="workflow:manage">
                  <WorkflowEditor />
                </ProtectedRoute>
              }
            />
            <Route
              path="workflows/:id"
              element={
                <ProtectedRoute permission="workflow:view">
                  <WorkflowDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="workflows/:id/editar"
              element={
                <ProtectedRoute permission="workflow:manage">
                  <WorkflowEditor />
                </ProtectedRoute>
              }
            />
            <Route
              path="usuarios"
              element={
                <ProtectedRoute permission="users:manage">
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="usuarios/nuevo"
              element={
                <ProtectedRoute permission="users:manage">
                  <AddUser />
                </ProtectedRoute>
              }
            />
            <Route
              path="usuarios/:uid"
              element={
                <ProtectedRoute permission="users:manage">
                  <UserDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="usuarios/:uid/editar"
              element={
                <ProtectedRoute permission="users:manage">
                  <EditUser />
                </ProtectedRoute>
              }
            />
            <Route path="perfil" element={<Profile />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
