// [Historias · ErrorBoundary]: fallback por defecto, fallback propio (render prop) y subárbol sano | [Patrón]: CSF 3 + Error Boundary + Render Prop | [Principio]: SRP | [Paradigma]: OO (clase React) + Declarativo
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test"; // `fn` (Storybook): espía → registra cada onError en el panel Actions | [Patrón]: Spy
import { ErrorBoundary } from "./ErrorBoundary";

// [Boom]: componente que lanza al renderizar → provoca el fallback | `never` (TS): la función nunca devuelve
function Boom(): never {
  throw new Error("No se pudo cargar la lección.");
}

const meta = {
  title: "Shared/ErrorBoundary",
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Fallback por defecto, fallback propio (render prop) y subárbol sano.\n\n**Patrón:** CSF 3 + Error Boundary + Render Prop · **Principio:** SRP · **Paradigma:** OO (clase React) + Declarativo" } } },
  component: ErrorBoundary,
  args: { children: <Boom />, onError: fn() },
} satisfies Meta<typeof ErrorBoundary>;

export default meta;
type Story = StoryObj<typeof meta>;

// [Fallback por defecto]: role="alert" + «Reintentar» (reset)
export const DefaultFallback: Story = {};
// [Render prop]: la página decide el aspecto con el error y la función de reinicio
export const CustomFallback: Story = {
  args: {
    fallback: (error, reset) => (
      <p role="alert" className="text-tone-danger">
        {error.message}{" "}
        <button type="button" className="underline" onClick={reset}>
          Reintentar
        </button>
      </p>
    ),
  },
};
// [Sin error]: el boundary es transparente y pinta los hijos tal cual
export const Healthy: Story = { args: { children: <p>Contenido cargado correctamente.</p> } };
