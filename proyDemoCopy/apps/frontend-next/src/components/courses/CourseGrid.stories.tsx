// [Historias · CourseGrid · 2026-11-17]: Rejilla de tarjetas de curso | [Patrón]: CSF 3 + Composite + Null Object (lista vacía) | [Principio]: DRY | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { courses } from "@/docs/story-fixtures"; // [Object Mother]: datos de ejemplo compartidos
import { CourseGrid } from "./CourseGrid";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Courses/CourseGrid",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Rejilla de tarjetas de curso\n\n**Patrón:** Composite + Null Object (lista vacía) · **Principio:** DRY · **Paradigma:** Declarativo" } } },
  component: CourseGrid,
  args: { courses },
} satisfies Meta<typeof CourseGrid>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
export const Empty: Story = { args: { courses: [], emptyMessage: "No hay cursos con esos filtros." } };
