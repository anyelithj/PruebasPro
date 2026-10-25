// [Test Dialog]: wrapper sobre Radix — apertura por trigger, accesibilidad y cierre
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function harness({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger>Abrir</DialogTrigger>
      <DialogContent>
        <DialogTitle>Confirmación</DialogTitle>
        <DialogDescription>¿Eliminar el registro?</DialogDescription>
        <p>contenido</p>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("exporta los subcomponentes principales", () => {
    expect(Dialog).toBeDefined();
    expect(DialogTrigger).toBeDefined();
    expect(DialogContent).toBeDefined();
    expect(DialogTitle).toBeDefined();
    expect(DialogDescription).toBeDefined();
  });

  it("no renderiza contenido hasta abrir el trigger", () => {
    render(harness());
    expect(screen.queryByText(/¿eliminar el registro\?/i)).not.toBeInTheDocument();
  });

  it("abre el diálogo al pulsar el trigger", async () => {
    const user = userEvent.setup();
    render(harness());
    await user.click(screen.getByRole("button", { name: /abrir/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/¿eliminar el registro\?/i)).toBeInTheDocument();
  });

  it("expone título y descripción accesibles (aria-labelledby / aria-describedby)", async () => {
    render(harness({ defaultOpen: true }));
    const dialog = await screen.findByRole("dialog");
    const title = screen.getByText("Confirmación");
    const desc = screen.getByText(/¿eliminar el registro\?/i);
    expect(dialog).toHaveAttribute("aria-labelledby", title.id);
    expect(dialog).toHaveAttribute("aria-describedby", desc.id);
  });

  it("se cierra con el botón X (aria-label `Cerrar`)", async () => {
    const user = userEvent.setup();
    render(harness({ defaultOpen: true }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
