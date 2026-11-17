import { render } from '@testing-library/react'
import type { ComponentType } from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { exampleProcess, exampleUsers, exampleWorkflow } from '../.storybook/fixtures'
import { loginActions } from './redux/reducers/loginReducer'
import { setProcesses } from './redux/reducers/processReducers'
import { setUsers } from './redux/reducers/userReducers'
import { setWorkflows } from './redux/reducers/workflowReducers'
import { store } from './redux/store/store'
import * as FormShellStories from './components/accesories/FormShell.stories'
import * as NotFoundNoticeStories from './components/accesories/NotFoundNotice.stories'
import * as PageHeaderStories from './components/accesories/PageHeader.stories'
import * as SpinnerStories from './components/accesories/Spinner.stories'
import * as UserFormStories from './components/admin/UserForm.stories'
import * as BarChartStories from './components/dashboard/BarChart.stories'
import * as ProcessInformationStories from './components/ProcessInformation.stories'
import * as TaskFormStories from './components/tasks/TaskForm.stories'
import * as ProcessFormStories from './components/uploadProcess/ProcessForm.stories'
import * as WorkflowFormStories from './components/workflow/WorkflowForm.stories'
import * as WorkflowStepperStories from './components/workflow/WorkflowStepper.stories'

// La configuración real de Firebase necesita IndexedDB; en las pruebas no se conecta nada.
jest.mock('firebase/app', () => ({}))
jest.mock('firebase/auth', () => ({}))
jest.mock('firebase/firestore', () => ({}))
jest.mock('firebase/storage', () => ({}))
jest.mock('./firebase/firebaseConfig', () => ({ auth: {}, db: {}, googleProvider: {}, app: {} }))

type Props = Record<string, unknown>
interface StoriesModule {
  default: { component: ComponentType<Props>; args?: Props }
  [story: string]: unknown
}

/**
 * Prueba de humo: cada historia de Storybook debe renderizarse sin errores con el mismo
 * contexto que usa Storybook (store con datos de ejemplo + enrutador en memoria).
 */
const modules: Record<string, StoriesModule> = {
  FormShell: FormShellStories,
  NotFoundNotice: NotFoundNoticeStories,
  PageHeader: PageHeaderStories,
  Spinner: SpinnerStories,
  UserForm: UserFormStories,
  BarChart: BarChartStories,
  ProcessInformation: ProcessInformationStories,
  TaskForm: TaskFormStories,
  ProcessForm: ProcessFormStories,
  WorkflowForm: WorkflowFormStories,
  WorkflowStepper: WorkflowStepperStories,
} as never

beforeAll(() => {
  store.dispatch(loginActions.setUser({ user: exampleUsers[0], profile: exampleUsers[0] }))
  store.dispatch(setUsers(exampleUsers))
  store.dispatch(setWorkflows([exampleWorkflow]))
  store.dispatch(setProcesses([exampleProcess]))
})

describe('historias de Storybook', () => {
  Object.entries(modules).forEach(([name, mod]) => {
    const { default: meta, ...stories } = mod
    describe(name, () => {
      Object.entries(stories).forEach(([storyName, story]) => {
        it(`${storyName} se renderiza sin errores`, () => {
          const Component = meta.component
          const args = { ...meta.args, ...(story as { args?: Props }).args }
          const { container } = render(
            <Provider store={store}>
              <MemoryRouter>
                <Component {...args} />
              </MemoryRouter>
            </Provider>,
          )
          expect(container).not.toBeEmptyDOMElement()
        })
      })
    })
  })
})
