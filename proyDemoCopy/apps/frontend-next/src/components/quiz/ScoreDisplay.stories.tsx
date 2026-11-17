// [Historias · ScoreDisplay · 2026-11-17]: Puntaje final del examen | [Patrón]: CSF 3 + Atomic Design (molecule) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ScoreDisplay } from "./ScoreDisplay";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Quiz/ScoreDisplay",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Puntaje final del examen\n\n**Patrón:** Atomic Design (molecule) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: ScoreDisplay,
  args: { points: 850, correctCount: 8, totalQuestions: 10 },
} satisfies Meta<typeof ScoreDisplay>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
export const Perfect: Story = { args: { points: 1000, correctCount: 10 } };
