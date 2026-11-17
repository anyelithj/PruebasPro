// [Historias · TopicCreatePanel · 2026-11-17]: Paneles para crear un tema o una fuente sin salir del formulario | [Patrón]: CSF 3 + Atomic Design (organism) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test"; // `fn` (Storybook): espía → el panel Actions registra cada llamada
import { SourceCreatePanel, TopicCreatePanel } from "./CatalogCreatePanels";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Curriculum/CatalogCreatePanels",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Paneles para crear un tema o una fuente sin salir del formulario\n\n**Patrón:** Atomic Design (organism) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: TopicCreatePanel,
  args: { language: "en", level: "A2", skill: "grammar", onCreated: fn(), onCancel: fn() },
} satisfies Meta<typeof TopicCreatePanel>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Topic: Story = {};
export const Source: Story = { render: () => <SourceCreatePanel onCreated={() => undefined} onCancel={() => undefined} /> };
