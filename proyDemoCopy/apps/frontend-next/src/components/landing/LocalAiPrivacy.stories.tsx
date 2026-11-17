// [Historias · LocalAiPrivacy · 2026-11-17]: IA local y privacidad | [Patrón]: CSF 3 + Atomic Design (organism) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { dict } from "@/docs/story-fixtures"; // [Object Mother]: datos de ejemplo compartidos
import { LocalAiPrivacy } from "./LocalAiPrivacy";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Landing/LocalAiPrivacy",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "IA local y privacidad\n\n**Patrón:** Atomic Design (organism) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: LocalAiPrivacy,
  args: { l: dict.landing },
} satisfies Meta<typeof LocalAiPrivacy>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
