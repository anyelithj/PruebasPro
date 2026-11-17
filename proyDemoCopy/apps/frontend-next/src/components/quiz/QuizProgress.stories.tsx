// [Historias · QuizProgress · 2026-11-17]: Barra de progreso del examen (pregunta n de total) | [Patrón]: CSF 3 + Atomic Design (atom) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QuizProgress } from "./QuizProgress";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Quiz/QuizProgress",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Barra de progreso del examen (pregunta n de total)\n\n**Patrón:** Atomic Design (atom) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: QuizProgress,
  args: { current: 3, total: 10 },
} satisfies Meta<typeof QuizProgress>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
export const Finished: Story = { args: { current: 10, total: 10 } };
