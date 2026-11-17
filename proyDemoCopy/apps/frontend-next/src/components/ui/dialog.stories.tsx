// [Historias · Dialog]: ventana modal accesible (Radix) cerrada y abierta | [Patrón]: Component Story Format (CSF 3) + Atomic Design (molecule) + Composite | [Principio]: SRP (una historia = un estado) | [Paradigma]: Declarativo
// `import type` (TS): solo tipos, se borran al compilar | `Meta`/`StoryObj` (Storybook): contratos tipados de la historia (Type-Safe)
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
// `userEvent`/`within` (Storybook Test): simulan al usuario dentro del lienzo | [Patrón]: Page Object ligero
import { userEvent, within } from "storybook/test";
import { Button } from "./button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";

// `satisfies` (TS): valida la forma contra Meta<typeof Dialog> sin perder el tipo inferido
const meta = {
  title: "UI/Molecules/Dialog",
  component: Dialog,
  // [render]: composición completa Trigger → Content (Header + Footer) | [Patrón]: Composite (piezas pequeñas que se ensamblan)
  render: (args) => (
    <Dialog {...args}>
      {/* `asChild` (Radix): el Trigger no añade un <button> extra; usa el Button del sistema de diseño | [Patrón]: Slot */}
      <DialogTrigger asChild>
        <Button>Eliminar curso</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          {/* [A11y]: Title y Description quedan enlazados por aria-labelledby/aria-describedby (WAI-ARIA Dialog) */}
          <DialogTitle>¿Eliminar el curso?</DialogTitle>
          <DialogDescription>Esta acción no se puede deshacer. Las lecciones y el progreso de los estudiantes se perderán.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button variant="destructive">Eliminar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  // [docs.story.inline=false]: el overlay es `fixed` → en autodocs se aísla en un iframe propio para no tapar la página
  parameters: { docs: { description: { component: "Ventana modal accesible (Radix) cerrada y abierta.\n\n**Patrón:** Component Story Format (CSF 3) + Atomic Design (molecule) + Composite · **Principio:** SRP (una historia = un estado) · **Paradigma:** Declarativo" }, story: { inline: false, iframeHeight: 360 } } },
} satisfies Meta<typeof Dialog>;

export default meta;
// `type` (TS): alias del tipo de historia de este meta
type Story = StoryObj<typeof meta>;

// [Cerrado]: solo el botón disparador
export const Default: Story = {};

// [Abierto]: `play` (Storybook) pulsa el disparador → muestra el foco atrapado y el botón «Cerrar» | `async/await` (ES2017)
export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement); // `within` (Testing Library): consultas limitadas al lienzo de la historia
    await userEvent.click(canvas.getByRole("button", { name: "Eliminar curso" })); // Consulta por rol + nombre accesible = como lo encuentra un lector de pantalla
  },
};
