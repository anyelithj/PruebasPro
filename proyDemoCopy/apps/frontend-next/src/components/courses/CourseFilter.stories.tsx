// [Historias · CourseFilter · 2026-11-17]: Buscador y pestañas de idioma del catálogo | [Patrón]: CSF 3 + URL State | [Principio]: SSOT | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CourseFilter } from "./CourseFilter";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Courses/CourseFilter",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Buscador y pestañas de idioma del catálogo\n\n**Patrón:** URL State · **Principio:** SSOT · **Paradigma:** Declarativo" } } },
  component: CourseFilter,
  args: { activeChip: "ALL" },
} satisfies Meta<typeof CourseFilter>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
