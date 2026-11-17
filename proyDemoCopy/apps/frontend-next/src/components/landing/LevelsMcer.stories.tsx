// [Historias · LevelsMcer · 2026-11-17]: Niveles MCER A1–C2 | [Patrón]: CSF 3 + Atomic Design (organism) | [Principio]: SSOT | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { dict } from "@/docs/story-fixtures"; // [Object Mother]: datos de ejemplo compartidos
import { LevelsMcer } from "./LevelsMcer";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Landing/LevelsMcer",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Niveles MCER A1–C2\n\n**Patrón:** Atomic Design (organism) · **Principio:** SSOT · **Paradigma:** Declarativo" } } },
  component: LevelsMcer,
  args: { l: dict.landing },
} satisfies Meta<typeof LevelsMcer>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
