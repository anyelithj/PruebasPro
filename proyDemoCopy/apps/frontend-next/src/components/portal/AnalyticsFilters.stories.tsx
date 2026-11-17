// [Historias · AnalyticsFilters · 2026-11-17]: Filtro de periodo de la analítica (estado en la URL) | [Patrón]: CSF 3 + URL State | [Principio]: SSOT | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AnalyticsFilters } from "./AnalyticsFilters";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Portal/AnalyticsFilters",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Filtro de periodo de la analítica (estado en la URL)\n\n**Patrón:** URL State · **Principio:** SSOT · **Paradigma:** Declarativo" } } },
  component: AnalyticsFilters,
} satisfies Meta<typeof AnalyticsFilters>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {}; // useSearchParams lo simula `nextjs.appDirectory` del preview
