// [Historias · QuizForm · 2026-11-17]: Crear o editar un examen (a mano, importado o con IA) | [Patrón]: CSF 3 + Wizard + Strategy | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QuizForm } from "./QuizForm";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Quiz/QuizForm",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Crear o editar un examen (a mano, importado o con IA)\n\n**Patrón:** Wizard + Strategy · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: QuizForm,
} satisfies Meta<typeof QuizForm>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Create: Story = {};
