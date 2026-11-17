// [Historias · ImportPanel · 2026-11-17]: Importar recursos desde Excel, Word, PDF o un enlace | [Patrón]: CSF 3 + Strategy (extractor por formato) | [Principio]: OCP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test"; // `fn` (Storybook): espía → el panel Actions registra cada llamada
import { ImportPanel } from "./ImportPanel";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Curriculum/ImportPanel",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Importar recursos desde Excel, Word, PDF o un enlace\n\n**Patrón:** Strategy (extractor por formato) · **Principio:** OCP · **Paradigma:** Declarativo" } } },
  component: ImportPanel,
  args: { kind: "vocabulary", language: "en", onImport: fn() },
} satisfies Meta<typeof ImportPanel>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Button: Story = {};
export const Card: Story = { args: { variant: "card" } };
