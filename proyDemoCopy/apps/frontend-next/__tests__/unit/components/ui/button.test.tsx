// [Test Button]: variantes CVA + asChild + click | [Patrón]: Component Test | [Principio]: SRP
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, buttonVariants } from "@/components/ui/button";

describe("Button", () => {
  it("renderiza el texto hijo", () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });

  it("aplica data-variant y data-size por defecto", () => {
    render(<Button>X</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("data-variant", "default");
    expect(btn).toHaveAttribute("data-size", "default");
  });

  it("propaga la variante recibida", () => {
    render(<Button variant="destructive">Borrar</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", "destructive");
  });

  it("dispara onClick", async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("respeta disabled (no dispara onClick)", async () => {
    const onClick = jest.fn();
    render(
      <Button disabled onClick={onClick}>
        No
      </Button>,
    );
    expect(screen.getByRole("button")).toBeDisabled();
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("asChild renderiza el elemento hijo (Slot) en lugar de <button>", () => {
    render(
      <Button asChild>
        <a href="/x">Enlace</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Enlace" });
    expect(link).toHaveAttribute("data-slot", "button");
  });

  it("buttonVariants genera clases para combinaciones válidas", () => {
    expect(typeof buttonVariants({ variant: "outline", size: "sm" })).toBe("string");
  });
});
