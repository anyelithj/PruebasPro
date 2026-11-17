// [Historias · CourseMaterials · 2026-11-17]: Temario del detalle del curso con progreso | [Patrón]: CSF 3 + Atomic Design (organism) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { materials } from "@/docs/story-fixtures"; // [Object Mother]: datos de ejemplo compartidos
import { CourseMaterials } from "./CourseMaterials";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Courses/CourseMaterials",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Temario del detalle del curso con progreso\n\n**Patrón:** Atomic Design (organism) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: CourseMaterials,
  args: { courseId: "course-1", initial: materials, initialCompleted: ["m1"], canTrack: true, canManage: false, color: "#2563eb" },
} satisfies Meta<typeof CourseMaterials>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Student: Story = {};
export const Admin: Story = { args: { canManage: true } };
