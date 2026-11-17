// [Historias · TextImport]: importar contenido desde archivo o enlace | [Patrón]: CSF 3 + Callback (onText/onClear) | [Principio]: SRP | [Paradigma]: Declarativo + asíncrono
// [Nota]: Storybook no tiene el BFF (/api/media/extract-text) → un archivo o enlace real muestra el estado de error; un enlace de YouTube sí funciona (no llama al servidor)
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test"; // `fn`: espías → el panel Actions muestra el ImportedText entregado
import { TextImport } from "./TextImport";

const meta = {
  title: "Shared/TextImport",
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Importar contenido desde archivo o enlace.\n\n**Patrón:** CSF 3 + Callback (onText/onClear) · **Principio:** SRP · **Paradigma:** Declarativo + asíncrono" } } },
  component: TextImport,
  args: { onText: fn(), onClear: fn() },
} satisfies Meta<typeof TextImport>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
// [Compacto]: `hint={null}` → sin texto de ayuda (dentro de un subtema)
export const Compact: Story = { args: { hint: null, label: "Importar al subtema" } };
