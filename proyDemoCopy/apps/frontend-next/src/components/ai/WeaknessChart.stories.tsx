// [Historias · WeaknessChart · 2026-11-17]: Temas débiles y fuertes del estudiante | [Patrón]: CSF 3 + Atomic Design (organism) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WeaknessChart } from "./WeaknessChart";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "AI/WeaknessChart",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Temas débiles y fuertes del estudiante\n\n**Patrón:** Atomic Design (organism) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: WeaknessChart,
  args: { weakTopics: [{ topic: "Pasado simple", accuracy: 0.45, recommendation: "Repasa los verbos irregulares" }, { topic: "Preposiciones", accuracy: 0.55 }], strongTopics: ["Saludos", "Números"] },
} satisfies Meta<typeof WeaknessChart>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
export const NoWeakTopics: Story = { args: { weakTopics: [] } };
