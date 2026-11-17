// [Historias · TopicTitle · 2026-11-17]: Nombre del tema en el idioma con su pronunciación | [Patrón]: CSF 3 + Cache-aside (memoria) + Adapter | [Principio]: SRP | [Paradigma]: Reactivo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TopicTitle } from "./TopicTitle";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Language/TopicTitle",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Nombre del tema en el idioma con su pronunciación\n\n**Patrón:** Cache-aside (memoria) + Adapter · **Principio:** SRP · **Paradigma:** Reactivo" } } },
  component: TopicTitle,
  args: { topic: "family", language: "en" },
} satisfies Meta<typeof TopicTitle>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
export const Compact: Story = { args: { compact: true } };
