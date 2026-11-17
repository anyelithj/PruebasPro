// [Historias · TopbarSearch · 2026-11-17]: Buscador, menú de tema y de idioma de la barra superior | [Patrón]: CSF 3 + Atomic Design (molecules) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LanguageMenu, ThemeMenu, TopbarSearch } from "./PortalToolbar";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Portal/PortalToolbar",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Buscador, menú de tema y de idioma de la barra superior\n\n**Patrón:** Atomic Design (molecules) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: TopbarSearch,
} satisfies Meta<typeof TopbarSearch>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Search: Story = {};
// `render` (Storybook): los menús de tema e idioma no reciben props obligatorias
export const Menus: Story = { render: () => (<div className="flex gap-2"><ThemeMenu /><LanguageMenu /></div>) };
