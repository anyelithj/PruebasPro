// [Historias · CourseCard · 2026-11-17]: Tarjeta de curso (Server Component asíncrono) | [Patrón]: CSF 3 + Atomic Design (molecule) + RSC | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { course } from "@/docs/story-fixtures"; // [Object Mother]: datos de ejemplo compartidos
import { CourseCard } from "./CourseCard";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Courses/CourseCard",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Tarjeta de curso (Server Component asíncrono)\n\n**Patrón:** Atomic Design (molecule) + RSC · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: CourseCard,
  args: { course },
} satisfies Meta<typeof CourseCard>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {}; // `experimentalRSC` (main.ts): Storybook renderiza el componente async
