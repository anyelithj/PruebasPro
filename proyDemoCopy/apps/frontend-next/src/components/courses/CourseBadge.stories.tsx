// [Historias · CourseBadge · 2026-11-17]: Etiqueta de curso con color del idioma | [Patrón]: CSF 3 + Atomic Design (atom) + Theming por instancia | [Principio]: ISP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CourseBadge } from "./CourseBadge";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Courses/CourseBadge",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Etiqueta de curso con color del idioma\n\n**Patrón:** Atomic Design (atom) + Theming por instancia · **Principio:** ISP · **Paradigma:** Declarativo" } } },
  component: CourseBadge,
  args: { text: "A2", color: "#2563eb" },
} satisfies Meta<typeof CourseBadge>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Tag: Story = {};
export const Status: Story = { args: { text: "En curso", as: "status", size: "md" } };
