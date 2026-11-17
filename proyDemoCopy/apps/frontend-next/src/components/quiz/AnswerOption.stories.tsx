// [Historias · AnswerOption · 2026-11-17]: Opción de respuesta seleccionable con estado correcto/incorrecto | [Patrón]: CSF 3 + Atomic Design (molecule) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test"; // `fn` (Storybook): espía → el panel Actions muestra cada clic
import { AnswerOption } from "./AnswerOption";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Quiz/AnswerOption",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Opción de respuesta seleccionable con estado correcto/incorrecto\n\n**Patrón:** Atomic Design (molecule) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: AnswerOption,
  args: { label: "went", index: 1, selected: false, onSelect: fn() },
} satisfies Meta<typeof AnswerOption>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
export const Selected: Story = { args: { selected: true } }; // aria-pressed/aria-checked → no solo color (WCAG 1.4.1)
export const Correct: Story = { args: { selected: true, reveal: "correct", disabled: true } };
export const Incorrect: Story = { args: { selected: true, reveal: "incorrect", disabled: true } };
