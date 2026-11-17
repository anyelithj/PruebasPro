// [Historias · EmojiPicker · 2026-11-17]: Selector de emoji en un diálogo con búsqueda | [Patrón]: CSF 3 + Atomic Design (organism) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test"; // `fn` (Storybook): espía → el panel Actions registra cada llamada
import { EmojiPicker } from "./EmojiPicker";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Curriculum/EmojiPicker",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Selector de emoji en un diálogo con búsqueda\n\n**Patrón:** Atomic Design (organism) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: EmojiPicker,
  args: { value: "🍎", onSelect: fn() },
} satisfies Meta<typeof EmojiPicker>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
