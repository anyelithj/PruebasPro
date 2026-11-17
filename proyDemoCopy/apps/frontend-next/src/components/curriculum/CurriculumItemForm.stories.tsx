// [Historias · CurriculumItemForm · 2026-11-17]: Asistente para crear recursos (a mano, importados o con IA) | [Patrón]: CSF 3 + Wizard + Strategy (por tipo) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CurriculumItemForm } from "./CurriculumItemForm";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Curriculum/CurriculumItemForm",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Asistente para crear recursos (a mano, importados o con IA)\n\n**Patrón:** Wizard + Strategy (por tipo) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: CurriculumItemForm,
} satisfies Meta<typeof CurriculumItemForm>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Create: Story = {};
export const Admin: Story = { args: { canAdmin: true } };
