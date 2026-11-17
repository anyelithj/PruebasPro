import { act, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { exampleProcess, exampleTask, exampleUsers, exampleWorkflow } from '../.storybook/fixtures'
import type { Role } from './models'
import { setTasks } from './redux/actions/actionTask'
import { loginActions } from './redux/reducers/loginReducer'
import { setProcesses } from './redux/reducers/processReducers'
import { setUsers } from './redux/reducers/userReducers'
import { setWorkflows } from './redux/reducers/workflowReducers'
import { store } from './redux/store/store'
import ActiveProcesses from './components/getProcess/ActiveProcesses'
import MenuNavigation from './components/MenuNavigation'
import TaskList from './components/tasks/TaskList'
import UserManagement from './components/admin/UserManagement'
import WorkflowManager from './components/workflow/WorkflowManager'
import ProfileLoadError from './components/accesories/ProfileLoadError'
import DashboardRoutes from './routers/DashboardRoutes'

// Sin conexión real: Firebase y Firestore se simulan. Lo que se prueba es QUÉ BOTONES VE CADA ROL.
jest.mock('firebase/app', () => ({}))
jest.mock('firebase/auth', () => ({}))
jest.mock('firebase/firestore', () => ({ where: jest.fn(), orderBy: jest.fn(), limitToLast: jest.fn() }))
jest.mock('firebase/storage', () => ({}))
jest.mock('./firebase/firebaseConfig', () => ({ auth: {}, db: {}, googleProvider: {}, app: {} }))
jest.mock('./services/firestoreService', () => ({
  subscribe: jest.fn(() => () => undefined),
  create: jest.fn(),
  patch: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  read: jest.fn(),
  claimFirstAdmin: jest.fn(),
}))

const asRole = (role: Role) =>
  act(() => {
    const profile = { ...exampleUsers[0], role }
    store.dispatch(loginActions.setUser({ user: exampleUsers[0], profile }))
  })

const renderPage = (ui: ReactElement) =>
  render(
    <Provider store={store}>
      <MemoryRouter>{ui}</MemoryRouter>
    </Provider>,
  )

beforeEach(() => {
  act(() => {
    store.dispatch(setUsers(exampleUsers))
    store.dispatch(setWorkflows([exampleWorkflow]))
    store.dispatch(setProcesses([exampleProcess]))
    store.dispatch(setTasks([exampleTask]))
  })
})

describe('procesos: crear, listar, ver detalle, editar y eliminar', () => {
  it('administrador: ve todos los botones', () => {
    asRole('admin')
    renderPage(<ActiveProcesses />)
    expect(screen.getByRole('link', { name: /Nuevo proceso/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver detalle' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
  })

  it('miembro: crea, ve y edita, pero no elimina', () => {
    asRole('member')
    renderPage(<ActiveProcesses />)
    expect(screen.getByRole('link', { name: /Nuevo proceso/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver detalle' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument()
  })
})

describe('tareas: crear, listar, ver detalle, editar y eliminar', () => {
  it('administrador: ve todos los botones', () => {
    asRole('admin')
    renderPage(<TaskList />)
    expect(screen.getByRole('link', { name: /Nueva tarea/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
  })

  it('miembro: no ve «Eliminar»', () => {
    asRole('member')
    renderPage(<TaskList />)
    expect(screen.getByRole('link', { name: /Nueva tarea/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument()
  })
})

describe('usuarios: crear, listar, editar y eliminar', () => {
  it('administrador: ve los botones del CRUD', () => {
    asRole('admin')
    renderPage(<UserManagement />)
    expect(screen.getByRole('link', { name: /Nuevo usuario/ })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Editar' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Eliminar' }).length).toBeGreaterThan(0)
  })
})

describe('workflows', () => {
  it('administrador: ve, crea, edita y elimina', () => {
    asRole('admin')
    renderPage(<WorkflowManager />)
    expect(screen.getByRole('link', { name: /Nuevo flujo/ })).toBeInTheDocument()
    const row = screen.getByText('Soporte').closest('li') as HTMLElement
    expect(within(row).getByRole('link', { name: 'Ver' })).toBeInTheDocument()
    expect(within(row).getByRole('link', { name: 'Editar' })).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
  })

  it('miembro: ve los flujos pero no puede gestionarlos', () => {
    asRole('member')
    renderPage(<WorkflowManager />)
    expect(screen.getAllByRole('link', { name: 'Ver' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: /Nuevo flujo/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument()
  })
})

describe('menú lateral: historial y workflows', () => {
  it.each(['admin', 'manager', 'member', 'viewer'] as Role[])('%s ve «Historial» y «Workflows»', (role) => {
    asRole(role)
    renderPage(<MenuNavigation />)
    expect(screen.getByRole('link', { name: 'Historial' })).toHaveAttribute('href', '/app/historial')
    expect(screen.getByRole('link', { name: 'Workflows' })).toHaveAttribute('href', '/app/workflows')
  })

  it('solo el administrador ve «Usuarios y roles»', () => {
    asRole('admin')
    const { unmount } = renderPage(<MenuNavigation />)
    expect(screen.getByRole('link', { name: 'Usuarios y roles' })).toBeInTheDocument()
    unmount()
    asRole('manager')
    renderPage(<MenuNavigation />)
    expect(screen.queryByRole('link', { name: 'Usuarios y roles' })).not.toBeInTheDocument()
  })
})

describe('si no se puede cargar el perfil (reglas sin publicar, base sin crear…)', () => {
  it('ProfileLoadError explica la causa y ofrece reintentar', () => {
    const onRetry = jest.fn()
    render(
      <ProfileLoadError
        message="No se pudo cargar tu perfil (permission-denied)."
        onRetry={onRetry}
        onLogout={jest.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: 'No pudimos cargar tu perfil' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('permission-denied')
    expect(screen.getByText(/pnpm db:deploy/)).toBeInTheDocument()
    screen.getByRole('button', { name: 'Reintentar' }).click()
    expect(onRetry).toHaveBeenCalled()
  })

  it('el área privada muestra esa explicación en vez de ocultar todo en silencio', () => {
    act(() => {
      store.dispatch(loginActions.setUser({ user: exampleUsers[0], profile: null }))
      store.dispatch(loginActions.setError('No se pudo cargar tu perfil (permission-denied).'))
    })
    renderPage(<DashboardRoutes />)
    expect(screen.getByRole('heading', { name: 'No pudimos cargar tu perfil' })).toBeInTheDocument()
  })
})
