// [Historias · Label · 2026-11-17]: Etiqueta de formulario (Radix Label) | [Patrón]: CSF 3 + Atomic Design (atom) + Adapter (Radix) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Label } from "./label";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "UI/Label",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Etiqueta de formulario (Radix Label)\n\n**Patrón:** Atomic Design (atom) + Adapter (Radix) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: Label,
  args: { children: "Correo electrónico", htmlFor: "email" },
} satisfies Meta<typeof Label>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
