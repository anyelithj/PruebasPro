// [Historias · QuizGrid · 2026-11-17]: Rejilla responsive de tarjetas de examen | [Patrón]: CSF 3 + Atomic Design (organism) + Composite | [Principio]: DRY | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { quizzes } from "@/docs/story-fixtures"; // [Object Mother]: datos de ejemplo compartidos
import { QuizGrid } from "./QuizGrid";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Quiz/QuizGrid",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Rejilla responsive de tarjetas de examen\n\n**Patrón:** Atomic Design (organism) + Composite · **Principio:** DRY · **Paradigma:** Declarativo" } } },
  component: QuizGrid,
  args: { quizzes },
} satisfies Meta<typeof QuizGrid>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
export const WithScores: Story = { args: { completedMap: { "quiz-1": 90 } } };
export const Empty: Story = { args: { quizzes: [] } };
