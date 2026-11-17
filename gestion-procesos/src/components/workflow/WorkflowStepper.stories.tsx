import type { Meta, StoryObj } from '@storybook/react-vite'
import { DEFAULT_WORKFLOW } from '../../services/workflow'
import WorkflowStepper from './WorkflowStepper'

const meta = {
  title: 'Flujos/WorkflowStepper',
  component: WorkflowStepper,
  args: { workflow: DEFAULT_WORKFLOW, current: 'En revisión', canEdit: true, onMove: () => undefined },
} satisfies Meta<typeof WorkflowStepper>

export default meta
type Story = StoryObj<typeof meta>

export const ConAcciones: Story = {}
export const SoloLectura: Story = { args: { canEdit: false } }
export const EstadoFinal: Story = { args: { current: 'Finalizado' } }
