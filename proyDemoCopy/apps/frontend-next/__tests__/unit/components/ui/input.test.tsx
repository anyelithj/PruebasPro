// [Test Input]: primitive accesible con forwardRef | [Patrón]: Component Test | [Principio]: SRP + LSP
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/components/ui/input";

describe("Input", () => {
  it("renderiza con type text por defecto", () => {
    render(<Input placeholder="Nombre" />);
    const input = screen.getByPlaceholderText("Nombre");
    expect(input).toHaveAttribute("type", "text");
  });

  it("respeta el type recibido", () => {
    render(<Input type="email" placeholder="Correo" />);
    expect(screen.getByPlaceholderText("Correo")).toHaveAttribute("type", "email");
  });

  it("permite escribir texto (controlado por el usuario)", async () => {
    render(<Input placeholder="Texto" />);
    const input = screen.getByPlaceholderText("Texto");
    await userEvent.type(input, "hola");
    expect(input).toHaveValue("hola");
  });

  it("propaga atributos aria (aria-invalid)", () => {
    render(<Input aria-invalid placeholder="X" />);
    expect(screen.getByPlaceholderText("X")).toHaveAttribute("aria-invalid", "true");
  });

  it("reenvía la ref al elemento input (forwardRef)", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} placeholder="ref" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("respeta disabled", () => {
    render(<Input disabled placeholder="off" />);
    expect(screen.getByPlaceholderText("off")).toBeDisabled();
  });
});
