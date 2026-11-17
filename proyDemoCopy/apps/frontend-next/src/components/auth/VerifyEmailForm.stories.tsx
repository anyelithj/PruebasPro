// [Historias · VerifyEmailForm · 2026-11-17]: Verificación del correo con el token del enlace | [Patrón]: CSF 3 + Atomic Design (organism) | [Principio]: SRP | [Paradigma]: Reactivo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { VerifyEmailForm } from "./VerifyEmailForm";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Auth/VerifyEmailForm",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Verificación del correo con el token del enlace\n\n**Patrón:** Atomic Design (organism) · **Principio:** SRP · **Paradigma:** Reactivo" } } },
  component: VerifyEmailForm,
  args: { token: "token-de-ejemplo" },
} satisfies Meta<typeof VerifyEmailForm>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {}; // Sin backend: muestra el estado de error (enlace inválido)
