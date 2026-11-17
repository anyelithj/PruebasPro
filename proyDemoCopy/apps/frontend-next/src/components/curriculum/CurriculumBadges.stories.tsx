// [Historias · StatusBadge · 2026-11-17]: Estado editorial y procedencia de un recurso | [Patrón]: CSF 3 + Lookup Table | [Principio]: OCP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProvenanceBadge, StatusBadge } from "./CurriculumBadges";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Curriculum/CurriculumBadges",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Estado editorial y procedencia de un recurso\n\n**Patrón:** Lookup Table · **Principio:** OCP · **Paradigma:** Declarativo" } } },
  component: StatusBadge,
  args: { status: "review_required" },
} satisfies Meta<typeof StatusBadge>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Status: Story = {};
export const Approved: Story = { args: { status: "approved" } };
export const Provenance: Story = { render: () => (<div className="flex gap-2"><ProvenanceBadge provenance="generated" /><ProvenanceBadge provenance="expert_validated" /></div>) };
