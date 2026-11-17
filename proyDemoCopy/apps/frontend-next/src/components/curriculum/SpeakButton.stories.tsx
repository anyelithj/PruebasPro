// [Historias · SpeakButton · 2026-11-17]: Botón de pronunciación con la voz del navegador | [Patrón]: CSF 3 + Adapter (Web Speech API) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SpeakButton } from "./SpeakButton";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Curriculum/SpeakButton",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Botón de pronunciación con la voz del navegador\n\n**Patrón:** Adapter (Web Speech API) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: SpeakButton,
  args: { text: "apple", lang: "en", label: "Escuchar «apple»" },
} satisfies Meta<typeof SpeakButton>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
export const Slow: Story = { args: { slow: true, size: "md" } };
