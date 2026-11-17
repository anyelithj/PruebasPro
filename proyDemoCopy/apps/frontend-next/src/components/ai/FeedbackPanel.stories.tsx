// [Historias · FeedbackPanel · 2026-11-17]: Retroalimentación pedagógica por pregunta tras el examen | [Patrón]: CSF 3 + Atomic Design (organism) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { answers, feedbacks, questions } from "@/docs/story-fixtures"; // [Object Mother]: datos de ejemplo compartidos
import { FeedbackPanel } from "./FeedbackPanel";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "AI/FeedbackPanel",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Retroalimentación pedagógica por pregunta tras el examen\n\n**Patrón:** Atomic Design (organism) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: FeedbackPanel,
  args: { answers, questions, feedbacks },
} satisfies Meta<typeof FeedbackPanel>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
export const WithoutFeedback: Story = { args: { feedbacks: {} } };
