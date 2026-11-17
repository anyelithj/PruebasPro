// [Historias · ChartBars · 2026-11-17]: Gráfico de barras ligero (CSS, sin librerías) | [Patrón]: CSF 3 + Atomic Design (molecule) | [Principio]: KISS | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ChartBars } from "./ChartBars";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Portal/ChartBars",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Gráfico de barras ligero (CSS, sin librerías)\n\n**Patrón:** Atomic Design (molecule) · **Principio:** KISS · **Paradigma:** Declarativo" } } },
  component: ChartBars,
  args: { bars: [{ label: "Lun", height: 40, value: 4 }, { label: "Mar", height: 70, value: 7 }, { label: "Mié", height: 55, value: 5 }, { label: "Jue", height: 90, value: 9 }], yLabel: "Sesiones", xLabel: "Día" },
} satisfies Meta<typeof ChartBars>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
