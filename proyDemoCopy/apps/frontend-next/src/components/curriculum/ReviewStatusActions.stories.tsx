// [Historias · ReviewStatusActions · 2026-11-17]: Botones del flujo editorial (revisar, aprobar, archivar) | [Patrón]: CSF 3 + State Machine (estado editorial) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ReviewStatusActions } from "./ReviewStatusActions";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Curriculum/ReviewStatusActions",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Botones del flujo editorial (revisar, aprobar, archivar)\n\n**Patrón:** State Machine (estado editorial) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: ReviewStatusActions,
  args: { id: "item-1", status: "review_required", version: 1 },
} satisfies Meta<typeof ReviewStatusActions>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const ReviewRequired: Story = {};
export const Draft: Story = { args: { status: "draft" } };
export const TeacherCannotApprove: Story = { args: { canApprove: false } };
