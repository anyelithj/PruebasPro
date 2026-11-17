// [Historias · CourseLesson · 2026-11-17]: Lección con visor, navegación y desbloqueo secuencial | [Patrón]: CSF 3 + Atomic Design (template) + Context (progreso) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CourseProgressProvider } from "./CourseProgressProvider"; // [Context]: progreso compartido del curso
import { materials } from "@/docs/story-fixtures"; // [Object Mother]: datos de ejemplo compartidos
import { CourseLesson } from "./CourseLesson";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Courses/CourseLesson",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Lección con visor, navegación y desbloqueo secuencial\n\n**Patrón:** Atomic Design (template) + Context (progreso) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: CourseLesson,
  args: { courseId: "course-1", items: materials, index: 2, color: "#2563eb", lang: "en" },
  decorators: [(Story) => (<CourseProgressProvider courseId="course-1" materialIds={materials.map((m) => m.id)} topicTitles={[]} initialMaterials={["m1"]} initialTopics={[]} canTrack><Story /></CourseProgressProvider>)],
} satisfies Meta<typeof CourseLesson>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const LinkLesson: Story = {};
