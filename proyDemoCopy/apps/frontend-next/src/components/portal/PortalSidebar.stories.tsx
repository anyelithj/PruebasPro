// [Historias · PortalSidebar · 2026-11-17]: Menú lateral del portal por rol | [Patrón]: CSF 3 + Strategy (NAV_BY_ROLE) + Atomic Design (organism) | [Principio]: OCP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PortalSidebar } from "./PortalSidebar";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Portal/PortalSidebar",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Menú lateral del portal por rol\n\n**Patrón:** Strategy (NAV_BY_ROLE) + Atomic Design (organism) · **Principio:** OCP · **Paradigma:** Declarativo" } } },
  component: PortalSidebar,
  args: { role: "estudiante", displayName: "Ana Pérez" },
} satisfies Meta<typeof PortalSidebar>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Student: Story = {};
export const Teacher: Story = { args: { role: "docente" } };
export const Admin: Story = { args: { role: "admin" } };
