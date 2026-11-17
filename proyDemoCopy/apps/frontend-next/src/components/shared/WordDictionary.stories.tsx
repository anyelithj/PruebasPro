// [Historias · WordDictionary · 2026-11-17]: Diccionario al pulsar una palabra (escucha clics en el documento) | [Patrón]: CSF 3 + Observer (eventos del DOM) | [Principio]: SRP | [Paradigma]: Reactivo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WordDictionary } from "./WordDictionary";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Shared/WordDictionary",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Diccionario al pulsar una palabra (escucha clics en el documento)\n\n**Patrón:** Observer (eventos del DOM) · **Principio:** SRP · **Paradigma:** Reactivo" } } },
  component: WordDictionary,
} satisfies Meta<typeof WordDictionary>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

// `render` (Storybook): texto pulsable + el diccionario global que lo escucha
export const Default: Story = { render: () => (<><p lang="en">Click a word: <span>apple</span> <span>house</span></p><WordDictionary /></>) };
