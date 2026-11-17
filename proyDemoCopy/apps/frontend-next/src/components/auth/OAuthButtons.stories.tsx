// [Historias · OAuthButtons · 2026-11-17]: Botón «Continuar con Google» y acceso por enlace mágico | [Patrón]: CSF 3 + Adapter (Server Action simulada con sb.mock) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MagicLinkForm, OAuthButtons } from "./OAuthButtons";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Auth/OAuthButtons",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Botón «Continuar con Google» y acceso por enlace mágico\n\n**Patrón:** Adapter (Server Action simulada con sb.mock) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: OAuthButtons,
} satisfies Meta<typeof OAuthButtons>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Google: Story = {};
export const MagicLink: Story = { render: () => <MagicLinkForm /> }; // `render` (Storybook): segundo componente del mismo archivo
