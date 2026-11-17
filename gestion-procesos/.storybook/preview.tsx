import type { Preview } from '@storybook/react-vite'
import { useEffect } from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { loginActions } from '../src/redux/reducers/loginReducer'
import { setProcesses } from '../src/redux/reducers/processReducers'
import { setUsers } from '../src/redux/reducers/userReducers'
import { setWorkflows } from '../src/redux/reducers/workflowReducers'
import { store } from '../src/redux/store/store'
import '../src/styles/config.scss'
import { exampleProcess, exampleUsers, exampleWorkflow } from './fixtures'

// Todas las historias comparten el store real, precargado con datos de ejemplo y una sesión de administrador.
const WithApp: NonNullable<Preview['decorators']>[number] = (Story) => {
  useEffect(() => {
    store.dispatch(loginActions.setUser({ user: exampleUsers[0], profile: exampleUsers[0] }))
    store.dispatch(setUsers(exampleUsers))
    store.dispatch(setWorkflows([exampleWorkflow]))
    store.dispatch(setProcesses([exampleProcess]))
  }, [])
  return (
    <Provider store={store}>
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    </Provider>
  )
}

const preview: Preview = {
  decorators: [WithApp],
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: 'todo' },
  },
}

export default preview
