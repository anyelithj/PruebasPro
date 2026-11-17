// [Historias · AccentSwitch]: interruptor de acento UK/US (role="switch") | [Patrón]: CSF 3 + Atomic Design (molecule) | [Principio]: SRP | [Paradigma]: Declarativo
// [Estado]: lo guarda la cookie `aula-accent` (hook useAccent) → al pulsar en Storybook cambia igual que en la app | [Patrón]: Observer
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AccentSwitch } from "./AccentSwitch";

// `satisfies` (TS): comprueba el meta sin ensanchar el tipo
const meta = {
  title: "Shared/AccentSwitch",
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Interruptor de acento UK/US (role=\"switch\").\n\n**Patrón:** CSF 3 + Atomic Design (molecule) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: AccentSwitch, // Sin props: el estado sale del hook (SSOT de la cookie)
} satisfies Meta<typeof AccentSwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

// [Default]: pulsar alterna UK ↔ US; el texto (no solo el color) indica el acento activo (WCAG 1.4.1)
export const Default: Story = {};
