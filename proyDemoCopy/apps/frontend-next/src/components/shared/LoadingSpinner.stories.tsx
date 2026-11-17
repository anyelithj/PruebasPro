// [Historias · LoadingSpinner]: indicador de carga de los loading.tsx | [Patrón]: CSF 3 + Presentational (RSC) | [Principio]: SRP | [Paradigma]: Declarativo
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LoadingSpinner } from "./LoadingSpinner";

const meta = {
  title: "Shared/LoadingSpinner",
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Indicador de carga de los loading.tsx.\n\n**Patrón:** CSF 3 + Presentational (RSC) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: LoadingSpinner,
  args: { className: "min-h-48" }, // Altura reducida para el lienzo (en la app ocupa 60vh)
} satisfies Meta<typeof LoadingSpinner>;

export default meta;
type Story = StoryObj<typeof meta>;

// [A11y]: role="status" + texto sr-only → el lector anuncia «Cargando…»
export const Default: Story = {};
export const CustomLabel: Story = { args: { label: "Generando el plan de estudio…" } };
