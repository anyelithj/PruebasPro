import type { Meta, StoryObj } from '@storybook/react-vite'
import UserForm, { emptyUser } from './UserForm'

const existing = {
  displayName: 'Luis Pérez',
  email: 'luis@ejemplo.co',
  password: '',
  role: 'member' as const,
  position: 'Analista',
  active: true,
}

const meta = {
  title: 'Formularios/UserForm',
  component: UserForm,
  parameters: {
    docs: {
      description: {
        component:
          'Un solo formulario para **crear**, **editar** y **ver el detalle** de un usuario. El correo no se cambia después de crear la cuenta.',
      },
    },
  },
  args: { mode: 'create' },
} satisfies Meta<typeof UserForm>

export default meta
type Story = StoryObj<typeof meta>

export const Crear: Story = { args: { mode: 'create', initial: emptyUser, onSubmit: async () => undefined } }
export const Editar: Story = { args: { mode: 'edit', initial: existing, onSubmit: async () => undefined } }
export const EditarMiPropioUsuario: Story = {
  args: { mode: 'edit', isSelf: true, initial: { ...existing, role: 'admin' }, onSubmit: async () => undefined },
}
export const Ver: Story = { args: { mode: 'view', initial: existing } }
