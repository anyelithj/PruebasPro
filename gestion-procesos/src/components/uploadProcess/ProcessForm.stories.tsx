import type { Meta, StoryObj } from '@storybook/react-vite'
import { exampleProcess } from '../../../.storybook/fixtures'
import ProcessForm, { emptyProcess } from './ProcessForm'

const meta = {
  title: 'Formularios/ProcessForm',
  component: ProcessForm,
  parameters: {
    docs: {
      description: {
        component: 'Un solo formulario para **crear**, **editar** y **ver el detalle** de un proceso o solicitud.',
      },
    },
  },
  args: { mode: 'create' },
} satisfies Meta<typeof ProcessForm>

export default meta
type Story = StoryObj<typeof meta>

export const Crear: Story = { args: { mode: 'create', initial: emptyProcess, onSubmit: async () => undefined } }
export const Editar: Story = {
  args: {
    mode: 'edit',
    initial: { ...exampleProcess },
    currentStatus: exampleProcess.status,
    submitLabel: 'Guardar cambios',
    onSubmit: async () => undefined,
  },
}
export const Ver: Story = {
  args: {
    mode: 'view',
    initial: { ...exampleProcess },
    currentStatus: exampleProcess.status,
    summary: 'Acceso al sistema de nómina para un analista nuevo.',
  },
}
