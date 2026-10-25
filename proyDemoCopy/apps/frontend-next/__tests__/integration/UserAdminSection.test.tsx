// [Integration · Admin crear usuario]: flujo completo form RHF + Zod + fetch + router — el campo Sección solo aplica a Estudiante | [Patrón]: Integration Test (jsdom) | [Principio]: Determinista
// [Cobertura corrección 2026-06-01]: integra visibilidad condicional de Sección + normalización del payload + navegación post-éxito
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NewUserPage from "@/app/(portal)/admin/users/new/page";

const pushMock = jest.fn();
const refreshMock = jest.fn();
const backMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock, back: backMock }),
}));

const fillRequired = async () => {
  await userEvent.type(screen.getByLabelText("Nombre *"), "Ada");
  await userEvent.type(screen.getByLabelText("Apellido *"), "Lovelace");
  await userEvent.type(screen.getByLabelText("Email *"), "ada@test.com");
  await userEvent.type(screen.getByLabelText("Contraseña *"), "Secret12");
};

const lastBody = () => JSON.parse((global.fetch as jest.Mock).mock.calls.at(-1)![1].body as string);

describe("Integration · alta de usuario admin · Sección por rol", () => {
  beforeEach(() => {
    pushMock.mockClear();
    refreshMock.mockClear();
    backMock.mockClear();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "u1" }) });
  });
  afterEach(() => jest.restoreAllMocks());

  it("Estudiante: muestra Sección, la persiste y navega al listado tras éxito", async () => {
    render(<NewUserPage />);
    // rol por defecto = Estudiante → Sección visible
    expect(screen.getByLabelText("Sección")).toBeInTheDocument();
    await fillRequired();
    await userEvent.type(screen.getByLabelText("Sección"), "2024-2");
    await userEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/users",
      expect.objectContaining({ method: "POST" }),
    );
    expect(lastBody()).toMatchObject({ role: "USER", section: "2024-2" });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/users"));
    expect(refreshMock).toHaveBeenCalled();
  });

  it("Docente: oculta Sección y envía section vacío", async () => {
    render(<NewUserPage />);
    await userEvent.selectOptions(screen.getByLabelText("Rol *"), "TEACHER");
    expect(screen.queryByLabelText("Sección")).not.toBeInTheDocument();
    await fillRequired();
    await userEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(lastBody()).toMatchObject({ role: "TEACHER", section: "" });
  });

  it("alternar Docente→Estudiante reaparece el campo Sección", async () => {
    render(<NewUserPage />);
    await userEvent.selectOptions(screen.getByLabelText("Rol *"), "TEACHER");
    expect(screen.queryByLabelText("Sección")).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Rol *"), "USER");
    expect(screen.getByLabelText("Sección")).toBeInTheDocument();
  });
});
