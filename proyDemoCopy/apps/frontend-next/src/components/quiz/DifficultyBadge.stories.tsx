// [Historias · DifficultyBadge · 2026-11-17]: Etiqueta de dificultad (fácil, media, difícil) | [Patrón]: CSF 3 + Atomic Design (atom) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DifficultyBadge } from "./DifficultyBadge";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Quiz/DifficultyBadge",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Etiqueta de dificultad (fácil, media, difícil)\n\n**Patrón:** Atomic Design (atom) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: DifficultyBadge,
  args: { difficulty: "easy" },
} satisfies Meta<typeof DifficultyBadge>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Easy: Story = {};
export const Medium: Story = { args: { difficulty: "medium" } };
export const Hard: Story = { args: { difficulty: "hard" } };
