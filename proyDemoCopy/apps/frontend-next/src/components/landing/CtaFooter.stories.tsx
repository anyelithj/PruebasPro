// [Historias · CtaFooter · 2026-11-17]: Llamada final a registrarse | [Patrón]: CSF 3 + Atomic Design (organism) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { dict } from "@/docs/story-fixtures"; // [Object Mother]: datos de ejemplo compartidos
import { CtaFooter } from "./CtaFooter";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Landing/CtaFooter",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Llamada final a registrarse\n\n**Patrón:** Atomic Design (organism) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: CtaFooter,
  args: { l: dict.landing, n: dict.publicNav },
} satisfies Meta<typeof CtaFooter>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
