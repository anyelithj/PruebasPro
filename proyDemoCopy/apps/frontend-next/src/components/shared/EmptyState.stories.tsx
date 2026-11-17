// [Historias · EmptyState]: estado vacío de listas y búsquedas | [Patrón]: CSF 3 + Atomic Design (molecule) + Slots (icon, action) | [Principio]: SRP | [Paradigma]: Declarativo
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SearchX } from "lucide-react"; // [lucide-react]: icono SVG del set del portal
import { Button } from "@/components/ui/button";
import { EmptyState } from "./EmptyState";

const meta = {
  title: "Shared/EmptyState",
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Estado vacío de listas y búsquedas.\n\n**Patrón:** CSF 3 + Atomic Design (molecule) + Slots (icon, action) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: EmptyState,
  args: { title: "Aún no hay cursos", description: "Cuando crees un curso aparecerá aquí." },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
// [Slots]: icono decorativo (aria-hidden) + llamada a la acción
export const WithIconAndAction: Story = {
  args: {
    title: "Sin resultados",
    description: "Prueba con otra palabra o quita los filtros.",
    icon: <SearchX aria-hidden className="size-8" />,
    action: <Button size="sm">Limpiar filtros</Button>,
  },
};
