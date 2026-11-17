// [Historias · CourseActions · 2026-11-17]: Botones de un curso (empezar, continuar, comprar) y reacciones | [Patrón]: CSF 3 + Strategy (variant) + Server Action simulada | [Principio]: OCP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CourseActions } from "./CourseActions";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Courses/CourseActions",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Botones de un curso (empezar, continuar, comprar) y reacciones\n\n**Patrón:** Strategy (variant) + Server Action simulada · **Principio:** OCP · **Paradigma:** Declarativo" } } },
  component: CourseActions,
  args: { courseId: "course-1", progress: 40, isFree: false, hasAccess: true, color: "#2563eb", engagement: { isFavorite: false, reaction: null, likesCount: 12, lovesCount: 5 } },
} satisfies Meta<typeof CourseActions>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const InProgress: Story = {};
export const NotStarted: Story = { args: { progress: 0 } };
export const Locked: Story = { args: { hasAccess: false, progress: 0 } };
export const Detail: Story = { args: { variant: "detail" } };
