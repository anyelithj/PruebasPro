// [Historias · Topbar · 2026-11-17]: Cabecera de página del portal (título, subtítulo y acciones) | [Patrón]: CSF 3 + Atomic Design (organism) + Slots | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Topbar } from "./Topbar";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Portal/Topbar",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Cabecera de página del portal (título, subtítulo y acciones)\n\n**Patrón:** Atomic Design (organism) + Slots · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: Topbar,
  args: { title: "Panel del docente", subtitle: "Resumen de tus grupos" },
} satisfies Meta<typeof Topbar>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
