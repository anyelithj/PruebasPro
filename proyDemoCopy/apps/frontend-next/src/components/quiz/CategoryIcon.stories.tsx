// [Historias · CategoryIcon · 2026-11-17]: Icono por habilidad del examen (gramática, vocabulario, lectura…) | [Patrón]: CSF 3 + Lookup Table | [Principio]: OCP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CategoryIcon } from "./CategoryIcon";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Quiz/CategoryIcon",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Icono por habilidad del examen (gramática, vocabulario, lectura…)\n\n**Patrón:** Lookup Table · **Principio:** OCP · **Paradigma:** Declarativo" } } },
  component: CategoryIcon,
  args: { category: "grammar", className: "size-8" },
} satisfies Meta<typeof CategoryIcon>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Grammar: Story = {};
export const Vocabulary: Story = { args: { category: "vocabulary" } };
export const Listening: Story = { args: { category: "listening" } };
