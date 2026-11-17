// [Historias · BusyOverlay · 2026-11-17]: Capa de «trabajando…» durante navegaciones y acciones lentas | [Patrón]: CSF 3 + Atomic Design (molecule) | [Principio]: SRP | [Paradigma]: Reactivo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BusyOverlay } from "./BusyOverlay";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Shared/BusyOverlay",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Capa de «trabajando…» durante navegaciones y acciones lentas\n\n**Patrón:** Atomic Design (molecule) · **Principio:** SRP · **Paradigma:** Reactivo" } } },
  component: BusyOverlay,
} satisfies Meta<typeof BusyOverlay>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
