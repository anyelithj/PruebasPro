// [Historias · QuestionCard · 2026-11-17]: Pregunta con sus opciones durante el examen | [Patrón]: CSF 3 + Atomic Design (organism) + Composite (AnswerOption) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { questions } from "@/docs/story-fixtures"; // [Object Mother]: datos de ejemplo compartidos
import { QuestionCard } from "./QuestionCard";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Quiz/QuestionCard",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Pregunta con sus opciones durante el examen\n\n**Patrón:** Atomic Design (organism) + Composite (AnswerOption) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: QuestionCard,
  args: { question: questions[0], selectedAnswer: null, onSelect: fn() },
} satisfies Meta<typeof QuestionCard>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
export const Answered: Story = { args: { selectedAnswer: "went", isLocked: true, revealCorrectAnswer: "went" } };
export const TrueFalse: Story = { args: { question: questions[1] } };
