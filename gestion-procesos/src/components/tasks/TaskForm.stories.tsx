import type { Meta, StoryObj } from '@storybook/react-vite'
import { exampleTask } from '../../../.storybook/fixtures'
import TaskForm, { emptyTask } from './TaskForm'

const meta = {
  title: 'Formularios/TaskForm',
  component: TaskForm,
  parameters: {
    docs: {
      description: {
        component:
          'Un solo formulario para **crear**, **editar** y **ver el detalle** de una tarea. Con `processId` queda vinculada a ese proceso.',
      },
    },
  },
  args: { mode: 'create' },
} satisfies Meta<typeof TaskForm>

export default meta
type Story = StoryObj<typeof meta>

export const Crear: Story = { args: { mode: 'create', initial: emptyTask, onSubmit: async () => undefined } }
export const DesdeUnProceso: Story = {
  args: {
    mode: 'create',
    processId: 'p1',
    submitLabel: 'Agregar tarea',
    resetOnSubmit: true,
    onSubmit: async () => undefined,
  },
}
export const Editar: Story = {
  args: { mode: 'edit', initial: { ...exampleTask }, submitLabel: 'Guardar cambios', onSubmit: async () => undefined },
}
export const Ver: Story = { args: { mode: 'view', initial: { ...exampleTask } } }
