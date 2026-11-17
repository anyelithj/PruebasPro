// [Historias · QuizActions · 2026-11-17]: Acciones de un examen en Gestión (ver, editar, publicar, eliminar) | [Patrón]: CSF 3 + Adapter (sobre RowActions) | [Principio]: DRY | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QuizActions } from "./QuizActions";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Quiz/QuizActions",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Acciones de un examen en Gestión (ver, editar, publicar, eliminar)\n\n**Patrón:** Adapter (sobre RowActions) · **Principio:** DRY · **Paradigma:** Declarativo" } } },
  component: QuizActions,
  args: { quizId: "quiz-1", title: "Pasado simple A2", isPublished: false, viewHref: "/quiz/quiz-1" },
} satisfies Meta<typeof QuizActions>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Draft: Story = {};
export const Published: Story = { args: { isPublished: true } };
