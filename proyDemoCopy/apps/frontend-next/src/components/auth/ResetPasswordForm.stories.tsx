// [Historias · ResetPasswordForm · 2026-11-17]: Nueva contraseña desde el enlace de recuperación | [Patrón]: CSF 3 + Atomic Design (organism) + Validación con Zod | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ResetPasswordForm } from "./ResetPasswordForm";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Auth/ResetPasswordForm",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Nueva contraseña desde el enlace de recuperación\n\n**Patrón:** Atomic Design (organism) + Validación con Zod · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: ResetPasswordForm,
  args: { token: "token-de-ejemplo" },
} satisfies Meta<typeof ResetPasswordForm>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
