// [Historias · ResultDialog]: modal «guardado con éxito» / «error» | [Patrón]: CSF 3 + Controlled Component | [Principio]: SRP + DRY | [Paradigma]: Declarativo
// [Textos]: usePreferences() sin Provider usa su Null Object (español) → no hace falta envolver la historia
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test"; // `fn`: espía de onClose en el panel Actions | [Patrón]: Spy
import { ResultDialog } from "./ResultDialog";

const meta = {
  title: "Shared/ResultDialog",
  component: ResultDialog,
  args: { result: { ok: true, message: "El curso «Inglés A2» se creó correctamente." }, onClose: fn() },
  // [inline=false]: modal `fixed` → iframe propio en autodocs (no tapa la página de documentación)
  parameters: { docs: { description: { component: "Modal «guardado con éxito» / «error».\n\n**Patrón:** CSF 3 + Controlled Component · **Principio:** SRP + DRY · **Paradigma:** Declarativo" }, story: { inline: false, iframeHeight: 320 } } },
} satisfies Meta<typeof ResultDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {};
// [Unión discriminada]: `ok: false` → icono de peligro y botón «Cerrar»
export const Failure: Story = { args: { result: { ok: false, message: "El título ya existe en este idioma." } } };
