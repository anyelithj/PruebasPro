// [Historias · Panel · 2026-11-17]: Tarjeta contenedora del portal con cabecera | [Patrón]: CSF 3 + Composite (Panel + PanelHead) + Slots | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Panel, PanelHead } from "./Panel";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Portal/Panel",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Tarjeta contenedora del portal con cabecera\n\n**Patrón:** Composite (Panel + PanelHead) + Slots · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: Panel,
  args: { children: "Contenido del panel" },
} satisfies Meta<typeof Panel>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

// `render` (Storybook): compone Panel + PanelHead como en los dashboards
export const WithHead: Story = {
  render: (args) => (
    <Panel {...args}>
      <PanelHead title="Actividad reciente" subtitle="Últimos 7 días" />
      <p className="p-4">Sin novedades.</p>
    </Panel>
  ),
};
