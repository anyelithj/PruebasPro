import type { Meta, StoryObj } from '@storybook/react-vite'
import WorkflowForm, { emptyWorkflow } from './WorkflowForm'

const existing = { name: 'Soporte', states: 'Recibida, En análisis, Resuelta' }

const meta = {
  title: 'Formularios/WorkflowForm',
  component: WorkflowForm,
  parameters: {
    docs: {
      description: {
        component: 'Un solo formulario para **crear**, **editar** y **ver el detalle** de un flujo de trabajo.',
      },
    },
  },
  args: { mode: 'create' },
} satisfies Meta<typeof WorkflowForm>

export default meta
type Story = StoryObj<typeof meta>

export const Crear: Story = { args: { mode: 'create', initial: emptyWorkflow, onSubmit: async () => undefined } }
export const Editar: Story = { args: { mode: 'edit', initial: existing, onSubmit: async () => undefined } }
export const Ver: Story = { args: { mode: 'view', initial: existing } }
