// [Historias · LanguagesGrid · 2026-11-17]: Los siete idiomas con su número de cursos | [Patrón]: CSF 3 + Atomic Design (organism) | [Principio]: SSOT | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { dict } from "@/docs/story-fixtures"; // [Object Mother]: datos de ejemplo compartidos
import { LanguagesGrid } from "./LanguagesGrid";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Landing/LanguagesGrid",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Los siete idiomas con su número de cursos\n\n**Patrón:** Atomic Design (organism) · **Principio:** SSOT · **Paradigma:** Declarativo" } } },
  component: LanguagesGrid,
  args: { l: dict.landing, locale: "es", counts: { EN: 4, FR: 2, DE: 1 } },
} satisfies Meta<typeof LanguagesGrid>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
