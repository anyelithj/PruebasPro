// [Historias · PolyglotNavLink · 2026-11-17]: Enlace «Poliglota» en la sección de recursos | [Patrón]: CSF 3 + Atomic Design (atom) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PolyglotNavLink } from "./PolyglotNavLink";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Language/PolyglotNavLink",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Enlace «Poliglota» en la sección de recursos\n\n**Patrón:** Atomic Design (atom) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: PolyglotNavLink,
  args: { locale: "es" },
} satisfies Meta<typeof PolyglotNavLink>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
