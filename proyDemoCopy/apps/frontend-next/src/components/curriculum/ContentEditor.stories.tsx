// [Historias · ContentEditor · 2026-11-17]: Editor del contenido según el tipo de recurso | [Patrón]: CSF 3 + Strategy (EDITORS por tipo) | [Principio]: OCP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test"; // `fn` (Storybook): espía → el panel Actions registra cada llamada
import { ContentEditor } from "./ContentEditor";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Curriculum/ContentEditor",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Editor del contenido según el tipo de recurso\n\n**Patrón:** Strategy (EDITORS por tipo) · **Principio:** OCP · **Paradigma:** Declarativo" } } },
  component: ContentEditor,
  args: { kind: "common_error", language: "en", value: { incorrect: "She don't like tea", correct: "She doesn't like tea", explanationEs: "Concordancia del auxiliar." }, onChange: fn() },
} satisfies Meta<typeof ContentEditor>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const CommonError: Story = {};
