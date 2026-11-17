// [Historias · QuizCard · 2026-11-17]: Tarjeta de examen del catálogo | [Patrón]: CSF 3 + Atomic Design (molecule) | [Principio]: ISP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { quizItem } from "@/docs/story-fixtures"; // [Object Mother]: datos de ejemplo compartidos
import { QuizCard } from "./QuizCard";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Quiz/QuizCard",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Tarjeta de examen del catálogo\n\n**Patrón:** Atomic Design (molecule) · **Principio:** ISP · **Paradigma:** Declarativo" } } },
  component: QuizCard,
  args: { quiz: quizItem },
} satisfies Meta<typeof QuizCard>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
export const Completed: Story = { args: { completed: true, scorePct: 80 } };
export const Practice: Story = { args: { tag: "Práctica · sin certificado" } };
