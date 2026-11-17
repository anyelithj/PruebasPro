import type { Meta, StoryObj } from '@storybook/react-vite'
import NotFoundNotice from './NotFoundNotice'

const meta = {
  title: 'Estructura/NotFoundNotice',
  component: NotFoundNotice,
  args: { what: 'este proceso', to: '/app/procesos' },
} satisfies Meta<typeof NotFoundNotice>

export default meta
type Story = StoryObj<typeof meta>

export const Proceso: Story = {}
export const Tarea: Story = { args: { what: 'esta tarea', to: '/app/tareas' } }
