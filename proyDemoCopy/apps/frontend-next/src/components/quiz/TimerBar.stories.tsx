// [Historias · TimerBar · 2026-11-17]: Cuenta atrás de la pregunta (role=timer) | [Patrón]: CSF 3 + Atomic Design (atom) + Custom Hook (useTimer) | [Principio]: SRP | [Paradigma]: Reactivo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { TimerBar } from "./TimerBar";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Quiz/TimerBar",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Cuenta atrás de la pregunta (role=timer)\n\n**Patrón:** Atomic Design (atom) + Custom Hook (useTimer) · **Principio:** SRP · **Paradigma:** Reactivo" } } },
  component: TimerBar,
  args: { seconds: 30, onExpire: fn() },
} satisfies Meta<typeof TimerBar>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Running: Story = {};
export const Paused: Story = { args: { isPaused: true } };
