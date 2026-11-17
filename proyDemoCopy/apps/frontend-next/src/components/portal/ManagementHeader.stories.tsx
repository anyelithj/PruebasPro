// [Historias · ManagementHeader · 2026-11-17]: Pestañas de Gestión por rol (Server Component asíncrono) | [Patrón]: CSF 3 + Atomic Design (organism) + RSC | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ManagementHeader } from "./ManagementHeader";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Portal/ManagementHeader",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Pestañas de Gestión por rol (Server Component asíncrono)\n\n**Patrón:** Atomic Design (organism) + RSC · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: ManagementHeader,
  args: { role: "admin", active: "courses" },
} satisfies Meta<typeof ManagementHeader>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Admin: Story = {};
export const Teacher: Story = { args: { role: "docente", active: "exams" } };
