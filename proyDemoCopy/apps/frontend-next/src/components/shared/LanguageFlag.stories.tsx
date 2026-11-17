// [Historias · LanguageFlag · 2026-11-17]: Bandera SVG por idioma | [Patrón]: CSF 3 + Lookup Table | [Principio]: OCP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LanguageFlag } from "./LanguageFlag";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Shared/LanguageFlag",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Bandera SVG por idioma\n\n**Patrón:** Lookup Table · **Principio:** OCP · **Paradigma:** Declarativo" } } },
  component: LanguageFlag,
  args: { code: "en" },
} satisfies Meta<typeof LanguageFlag>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const English: Story = {};
export const Chinese: Story = { args: { code: "zh", size: 40 } };
export const Russian: Story = { args: { code: "ru" } };
