import type { Meta, StoryObj } from '@storybook/react-vite'
import BarChart from './BarChart'

const meta = {
  title: 'Indicadores/BarChart',
  component: BarChart,
  parameters: {
    docs: {
      description: {
        component:
          'Gráfico de barras hecho con CSS. Cada valor también aparece como texto, así que no depende solo del color.',
      },
    },
  },
} satisfies Meta<typeof BarChart>

export default meta
type Story = StoryObj<typeof meta>

export const Ejemplo: Story = {
  args: {
    title: 'Procesos por estado (datos de ejemplo)',
    data: [
      { label: 'Borrador', value: 3 },
      { label: 'En revisión', value: 5 },
      { label: 'Aprobado', value: 2 },
    ],
  },
}
export const SinDatos: Story = { args: { title: 'Procesos por estado', data: [] } }
