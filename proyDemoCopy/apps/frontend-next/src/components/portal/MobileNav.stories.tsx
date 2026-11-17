// [Historias · MobileNavButton · 2026-11-17]: Botón de menú móvil y plegado del menú lateral | [Patrón]: CSF 3 + Context + Provider | [Principio]: SRP | [Paradigma]: Reactivo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileNavButton, MobileNavProvider, SidebarToggleButton } from "./MobileNav";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Portal/MobileNav",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Botón de menú móvil y plegado del menú lateral\n\n**Patrón:** Context + Provider · **Principio:** SRP · **Paradigma:** Reactivo" } } },
  component: MobileNavButton,
  decorators: [(Story) => (<MobileNavProvider><Story /></MobileNavProvider>)], // [Decorator]: el botón necesita su contexto
} satisfies Meta<typeof MobileNavButton>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Mobile: Story = {};
export const SidebarToggle: Story = { render: () => <SidebarToggleButton /> };
