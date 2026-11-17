// [Historias · LoginForm · 2026-11-17]: Inicio de sesión con correo y contraseña, 2FA y Google | [Patrón]: CSF 3 + Atomic Design (organism) + Validación con Zod | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LoginForm } from "./LoginForm";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Auth/LoginForm",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Inicio de sesión con correo y contraseña, 2FA y Google\n\n**Patrón:** Atomic Design (organism) + Validación con Zod · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: LoginForm,
} satisfies Meta<typeof LoginForm>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {}; // Sin backend: al enviar muestra el error de red controlado
