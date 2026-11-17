import type { Meta, StoryObj } from '@storybook/react-vite'
import { exampleProcess } from '../../.storybook/fixtures'
import ProcessInformation from './ProcessInformation'

const meta = {
  title: 'Procesos/ProcessInformation',
  component: ProcessInformation,
  parameters: {
    docs: {
      description: {
        component:
          'Tarjeta resumen de un proceso. Las acciones (ver, editar, eliminar) aparecen según el rol; en estas historias la sesión es de administrador.',
      },
    },
  },
  args: { process: exampleProcess, ownerName: 'Ana Gómez', progress: 40, onDelete: () => undefined },
} satisfies Meta<typeof ProcessInformation>

export default meta
type Story = StoryObj<typeof meta>

export const Normal: Story = {}
export const Urgente: Story = { args: { process: { ...exampleProcess, priority: 'urgent' } } }
export const SinAvance: Story = { args: { progress: undefined } }
