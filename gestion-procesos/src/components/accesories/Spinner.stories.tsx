import type { Meta, StoryObj } from '@storybook/react-vite'
import Spinner from './Spinner'

const meta = { title: 'Estructura/Spinner', component: Spinner } satisfies Meta<typeof Spinner>

export default meta
type Story = StoryObj<typeof meta>

export const Cargando: Story = {}
export const ConEtiqueta: Story = { args: { label: 'Verificando sesión' } }
