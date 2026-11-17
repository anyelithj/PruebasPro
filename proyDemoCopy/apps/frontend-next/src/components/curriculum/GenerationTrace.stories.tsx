// [Historias · GenerationTrace · 2026-11-17]: Traza de la generación con IA (modelo, tokens, latencia) | [Patrón]: CSF 3 + Atomic Design (molecule) | [Principio]: Trazabilidad | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { generation } from "@/docs/story-fixtures"; // [Object Mother]: datos de ejemplo compartidos
import { GenerationTrace } from "./GenerationTrace";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Curriculum/GenerationTrace",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Traza de la generación con IA (modelo, tokens, latencia)\n\n**Patrón:** Atomic Design (molecule) · **Principio:** Trazabilidad · **Paradigma:** Declarativo" } } },
  component: GenerationTrace,
  args: { trace: generation },
} satisfies Meta<typeof GenerationTrace>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
export const HumanEdited: Story = { args: { humanEdited: true } };
