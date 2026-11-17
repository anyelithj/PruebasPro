// [Historias · PasswordInput · 2026-11-17]: Campo de contraseña con botón mostrar/ocultar | [Patrón]: CSF 3 + Atomic Design (atom) + forwardRef | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PasswordInput } from "./password-input";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "UI/PasswordInput",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Campo de contraseña con botón mostrar/ocultar\n\n**Patrón:** Atomic Design (atom) + forwardRef · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: PasswordInput,
  args: { placeholder: "Contraseña", "aria-label": "Contraseña" },
} satisfies Meta<typeof PasswordInput>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
