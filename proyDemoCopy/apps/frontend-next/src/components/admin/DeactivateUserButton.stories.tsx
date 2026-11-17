// [Historias · DeactivateUserButton · 2026-11-17]: Activar o desactivar un usuario con confirmación | [Patrón]: CSF 3 + Command + Confirm Dialog | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DeactivateUserButton } from "./DeactivateUserButton";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Admin/DeactivateUserButton",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Activar o desactivar un usuario con confirmación\n\n**Patrón:** Command + Confirm Dialog · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: DeactivateUserButton,
  args: { userId: "u1", userName: "Ana Pérez", isActive: true },
} satisfies Meta<typeof DeactivateUserButton>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Active: Story = {};
export const Inactive: Story = { args: { isActive: false } };
