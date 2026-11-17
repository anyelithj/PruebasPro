// [Historias · Tag · 2026-11-17]: Etiqueta de estado con tonos | [Patrón]: CSF 3 + Atomic Design (atom) | [Principio]: OCP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Tag } from "./Tag";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Portal/Tag",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Etiqueta de estado con tonos\n\n**Patrón:** Atomic Design (atom) · **Principio:** OCP · **Paradigma:** Declarativo" } } },
  component: Tag,
  args: { children: "Publicado" },
} satisfies Meta<typeof Tag>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
export const Success: Story = { args: { tone: "success", children: "Aprobado" } };
export const Amber: Story = { args: { tone: "amber", children: "En revisión" } };
export const Red: Story = { args: { tone: "red", children: "Rechazado" } };
