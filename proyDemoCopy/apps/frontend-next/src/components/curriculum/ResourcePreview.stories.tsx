// [Historias · ResourcePreview · 2026-11-17]: Vista previa de un recurso curricular | [Patrón]: CSF 3 + Strategy (vista por tipo) | [Principio]: OCP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ResourcePreview } from "./ResourcePreview";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Curriculum/ResourcePreview",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Vista previa de un recurso curricular\n\n**Patrón:** Strategy (vista por tipo) · **Principio:** OCP · **Paradigma:** Declarativo" } } },
  component: ResourcePreview,
  args: { kind: "vocabulary", language: "en", content: { lemma: "apple", translationEs: "manzana", ipa: { value: "ˈæp.əl", variant: "en-GB" }, examples: [{ text: "I eat an apple.", translationEs: "Como una manzana." }], emoji: "🍎" } },
} satisfies Meta<typeof ResourcePreview>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Vocabulary: Story = {};
export const CommonError: Story = { args: { kind: "common_error", content: { incorrect: "She don't like tea", correct: "She doesn't like tea", explanationEs: "Con «she» el auxiliar es «doesn't»." } } };
