// [Historias · SyllabusList · 2026-11-17]: Temario con estados Completado / En curso / Bloqueado | [Patrón]: CSF 3 + Atomic Design (organism) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { materials, syllabusLabels } from "@/docs/story-fixtures"; // [Object Mother]: datos de ejemplo compartidos
import { SyllabusList } from "./SyllabusList";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Courses/SyllabusList",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Temario con estados Completado / En curso / Bloqueado\n\n**Patrón:** Atomic Design (organism) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: SyllabusList,
  args: { courseId: "course-1", items: materials, done: new Set(["m1"]), activeIndex: 1, nextPending: 1, canTrack: true, color: "#2563eb", labels: syllabusLabels },
} satisfies Meta<typeof SyllabusList>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
export const Timeline: Story = { args: { timeline: true, openIndex: 1 } };
