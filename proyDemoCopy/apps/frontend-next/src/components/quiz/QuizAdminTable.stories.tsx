// [Historias · QuizAdminTable · 2026-11-17]: Tabla de exámenes en Gestión (idioma, categoría, estado) | [Patrón]: CSF 3 + Atomic Design (organism) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { quizzes } from "@/docs/story-fixtures"; // [Object Mother]: datos de ejemplo compartidos
import { QuizAdminTable } from "./QuizAdminTable";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Quiz/QuizAdminTable",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Tabla de exámenes en Gestión (idioma, categoría, estado)\n\n**Patrón:** Atomic Design (organism) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: QuizAdminTable,
  args: { quizzes },
} satisfies Meta<typeof QuizAdminTable>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
export const Empty: Story = { args: { quizzes: [] } }; // Null Object: tabla vacía con su mensaje
