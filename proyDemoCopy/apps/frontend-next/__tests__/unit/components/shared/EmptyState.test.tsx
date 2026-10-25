// [Test EmptyState]: render de título, descripción, icon y action; rol accesible
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/shared/EmptyState";

describe("EmptyState", () => {
  it("renderiza al menos el título y expone role=status (accesibilidad)", () => {
    render(<EmptyState title="Sin resultados" />);
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("muestra la descripción cuando se pasa", () => {
    render(<EmptyState title="Vacío" description="No hay datos para mostrar." />);
    expect(screen.getByText("No hay datos para mostrar.")).toBeInTheDocument();
  });

  it("no renderiza descripción si no se pasa la prop", () => {
    render(<EmptyState title="Vacío" />);
    expect(screen.queryByText(/no hay datos/i)).not.toBeInTheDocument();
  });

  it("renderiza icon y action en los slots provistos", () => {
    render(
      <EmptyState
        title="Vacío"
        icon={<span data-testid="icon">🗂️</span>}
        action={<button>Crear nuevo</button>}
      />,
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear nuevo/i })).toBeInTheDocument();
  });

  it("acepta className adicional sin perder los estilos base", () => {
    render(<EmptyState title="Vacío" className="custom-x" data-testid="root" />);
    expect(screen.getByTestId("root")).toHaveClass("custom-x");
    expect(screen.getByTestId("root")).toHaveClass("border-dashed");
  });
});
