import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from 'react-bootstrap'
import PageHeader from './PageHeader'

const meta = {
  title: 'Estructura/PageHeader',
  component: PageHeader,
  args: { title: 'Procesos activos', subtitle: 'Procesos y solicitudes que aún no han terminado.' },
} satisfies Meta<typeof PageHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Simple: Story = {}
export const ConVolverYAcciones: Story = {
  args: { back: { to: '/app/procesos', label: 'Procesos' }, actions: <Button>Nuevo proceso</Button> },
}
