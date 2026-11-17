// [Historias · Donut · 2026-11-17]: Anillo de porcentaje con conic-gradient | [Patrón]: CSF 3 + Atomic Design (atom) | [Principio]: KISS | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Donut } from "./Donut";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Portal/Donut",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Anillo de porcentaje con conic-gradient\n\n**Patrón:** Atomic Design (atom) · **Principio:** KISS · **Paradigma:** Declarativo" } } },
  component: Donut,
  args: { label: "72 %", gradient: "conic-gradient(var(--primary) 0 72%, var(--muted) 72% 100%)" },
} satisfies Meta<typeof Donut>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
