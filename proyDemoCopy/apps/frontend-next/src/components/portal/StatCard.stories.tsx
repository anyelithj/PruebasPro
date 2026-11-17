// [Historias · StatCard · 2026-11-17]: Indicador numérico del dashboard con variación | [Patrón]: CSF 3 + Atomic Design (molecule) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Users } from "lucide-react";
import { StatCard } from "./StatCard";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Portal/StatCard",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Indicador numérico del dashboard con variación\n\n**Patrón:** Atomic Design (molecule) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: StatCard,
  args: { label: "Estudiantes activos", value: 128, delta: "+12 %", icon: Users },
} satisfies Meta<typeof StatCard>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Up: Story = {};
export const Down: Story = { args: { delta: "-4 %", deltaDir: "down" } };
