// [Test ErrorBoundary]: captura error en render, fallback default + custom, reset
import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

// [Componente bomba]: lanza durante render si `boom` es true | [Patrón]: Test Double
function Boom({ boom }: { boom: boolean }) {
  if (boom) throw new Error("kaboom");
  return <p>ok</p>;
}

describe("ErrorBoundary", () => {
  // [silenciar logs de React 19]: el render fallido emite console.error con stacks | [Principio]: no contaminar salida CI
  let errSpy: jest.SpyInstance;
  beforeEach(() => {
    errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    errSpy.mockRestore();
  });

  it("renderiza children cuando no hay error", () => {
    render(
      <ErrorBoundary>
        <Boom boom={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  it("muestra el fallback por defecto al lanzar un error en render", () => {
    render(
      <ErrorBoundary>
        <Boom boom={true} />
      </ErrorBoundary>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/algo salió mal/i);
    expect(alert).toHaveTextContent("kaboom");
  });

  it("acepta fallback como ReactNode", () => {
    render(
      <ErrorBoundary fallback={<p>custom-fallback</p>}>
        <Boom boom={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("custom-fallback")).toBeInTheDocument();
  });

  it("acepta fallback como render prop (error, reset)", () => {
    render(
      <ErrorBoundary fallback={(err) => <p>render-prop: {err.message}</p>}>
        <Boom boom={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("render-prop: kaboom")).toBeInTheDocument();
  });

  it("invoca onError con el error capturado", () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Boom boom={true} />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect((onError.mock.calls[0][0] as Error).message).toBe("kaboom");
  });

  it("reset limpia el error y permite re-renderizar children sanos", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [boom, setBoom] = React.useState(true);
      return (
        <ErrorBoundary
          fallback={(_e, reset) => (
            <button
              onClick={() => {
                setBoom(false);
                reset();
              }}
            >
              retry
            </button>
          )}
        >
          <Boom boom={boom} />
        </ErrorBoundary>
      );
    }
    render(<Harness />);
    expect(screen.getByText("retry")).toBeInTheDocument();
    await user.click(screen.getByText("retry"));
    expect(screen.getByText("ok")).toBeInTheDocument();
  });
});
