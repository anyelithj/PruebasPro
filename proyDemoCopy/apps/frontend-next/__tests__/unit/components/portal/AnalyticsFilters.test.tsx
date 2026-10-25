// [Test AnalyticsFilters]: filtro de periodo + botón "Filtrar" que escribe ?period= en la URL | [Corrección]: filtro de periodo con botón (sin auto-aplicar, sin select de sección)
import { render, screen, fireEvent } from "@testing-library/react";
import { AnalyticsFilters } from "@/components/portal/AnalyticsFilters";

const pushMock = jest.fn();
let currentParams = new URLSearchParams("");

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/dashboard/docente",
  useSearchParams: () => currentParams,
}));

describe("AnalyticsFilters", () => {
  beforeEach(() => {
    pushMock.mockClear();
    currentParams = new URLSearchParams("");
  });

  it("muestra el select de periodo y un botón Filtrar (sin select de sección)", () => {
    render(<AnalyticsFilters />);
    expect(screen.getByLabelText("Periodo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtrar" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Sección")).not.toBeInTheDocument();
  });

  it("al pulsar Filtrar escribe ?period= en la URL", () => {
    render(<AnalyticsFilters />);
    fireEvent.change(screen.getByLabelText("Periodo"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock.mock.calls[0][0]).toContain("period=3");
  });

  it("no aplica el filtro hasta pulsar el botón (apply-on-submit)", () => {
    render(<AnalyticsFilters />);
    fireEvent.change(screen.getByLabelText("Periodo"), { target: { value: "6" } });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("'Todo el histórico' quita el parámetro period", () => {
    currentParams = new URLSearchParams("period=6");
    render(<AnalyticsFilters />);
    fireEvent.change(screen.getByLabelText("Periodo"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    expect(pushMock.mock.calls[0][0]).not.toContain("period=");
  });
});
