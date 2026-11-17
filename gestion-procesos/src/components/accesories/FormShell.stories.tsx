import type { Meta, StoryObj } from '@storybook/react-vite'
import { Form } from 'react-bootstrap'
import FormShell from './FormShell'

const meta = {
  title: 'Formularios/FormShell',
  component: FormShell,
  parameters: {
    docs: {
      description: {
        component:
          'Envoltorio común de los formularios de procesos, tareas, usuarios y workflows. **Crear, editar y ver el detalle usan los mismos campos**: solo cambia el `mode`. En `view` los campos quedan bloqueados (`<fieldset disabled>`) y desaparece el botón.',
      },
    },
  },
  args: { label: 'Formulario de ejemplo', mode: 'create', children: null },
  argTypes: { mode: { control: 'inline-radio', options: ['create', 'edit', 'view'] } },
} satisfies Meta<typeof FormShell>

export default meta
type Story = StoryObj<typeof meta>

const Fields = () => (
  <>
    <Form.Label htmlFor="demo-nombre">Nombre</Form.Label>
    <Form.Control id="demo-nombre" defaultValue="Ejemplo" />
  </>
)

export const Crear: Story = { args: { mode: 'create', children: <Fields /> } }
export const Editar: Story = { args: { mode: 'edit', children: <Fields /> } }
export const Ver: Story = { args: { mode: 'view', children: <Fields /> } }
export const ConError: Story = { args: { mode: 'create', error: 'El nombre es obligatorio.', children: <Fields /> } }
export const Guardando: Story = { args: { mode: 'edit', saving: true, children: <Fields /> } }
