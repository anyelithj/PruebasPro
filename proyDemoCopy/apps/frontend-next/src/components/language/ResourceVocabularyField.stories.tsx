// [Historias · ResourceVocabularyField · 2026-11-17]: Traducción e IPA automáticos al escribir un término | [Patrón]: CSF 3 + Debounce + Adapter (LanguageTools) | [Principio]: SRP | [Paradigma]: Reactivo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test"; // `fn` (Storybook): espía → el panel Actions registra cada llamada
import { ResourceVocabularyField } from "./ResourceVocabularyField";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Language/ResourceVocabularyField",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Traducción e IPA automáticos al escribir un término\n\n**Patrón:** Debounce + Adapter (LanguageTools) · **Principio:** SRP · **Paradigma:** Reactivo" } } },
  component: ResourceVocabularyField,
  args: { term: "apple", language: "en", onTranslation: fn(), onIpa: fn() },
} satisfies Meta<typeof ResourceVocabularyField>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {}; // Sin backend: no sugiere nada y no bloquea el formulario
