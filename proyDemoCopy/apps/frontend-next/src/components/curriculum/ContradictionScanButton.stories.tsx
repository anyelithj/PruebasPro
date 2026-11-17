// [Historias · ContradictionScanButton · 2026-11-17]: Busca contradicciones entre fuentes (Server Action simulada) | [Patrón]: CSF 3 + Command | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ContradictionScanButton } from "./ContradictionScanButton";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Curriculum/ContradictionScanButton",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Busca contradicciones entre fuentes (Server Action simulada)\n\n**Patrón:** Command · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: ContradictionScanButton,
  args: { language: "en" },
} satisfies Meta<typeof ContradictionScanButton>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
