// [Test NewUserPage]: alta de usuario admin — campo Sección visible SOLO para rol Estudiante (USER) | [Patrón]: Component Test | [Principio]: Determinista
// [Cobertura corrección 2026-06-01]: section condicional por rol + normalización en submit (section="" si no es estudiante)
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
  await userEvent.type(screen.getByLabelText("Repetir contraseña *"), "Secret12"); // [2026-10-24]: el alta exige repetir la contraseña (refine de Zod)
};

const lastPostBody = () => {
  const call = (global.fetch as jest.Mock).mock.calls.at(-1)!;
  return JSON.parse(call[1].body as string);
};

describe("NewUserPage · campo Sección por rol", () => {
  beforeEach(() => {
    pushMock.mockClear();
    refreshMock.mockClear();
    backMock.mockClear();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "u1" }) });
  });
  afterEach(() => jest.restoreAllMocks());

  it("muestra el campo Sección por defecto (rol Estudiante)", () => {
    render(<NewUserPage />);
    expect(screen.getByLabelText("Rol *")).toHaveValue("USER");
    expect(screen.getByLabelText("Sección / grupo")).toBeInTheDocument();
  });

  it("oculta Sección al elegir Docente y Administrador", async () => {
    render(<NewUserPage />);
    await userEvent.selectOptions(screen.getByLabelText("Rol *"), "TEACHER");
    expect(screen.queryByLabelText("Sección / grupo")).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Rol *"), "ADMIN");
    expect(screen.queryByLabelText("Sección / grupo")).not.toBeInTheDocument();
  });

  it("vuelve a mostrar Sección al regresar a Estudiante", async () => {
    render(<NewUserPage />);
    await userEvent.selectOptions(screen.getByLabelText("Rol *"), "TEACHER");
    expect(screen.queryByLabelText("Sección / grupo")).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Rol *"), "USER");
    expect(screen.getByLabelText("Sección / grupo")).toBeInTheDocument();
  });

  it("envía la sección cuando el rol es Estudiante", async () => {
    render(<NewUserPage />);
    await fillRequired();
    await userEvent.type(screen.getByLabelText("Sección / grupo"), "11-1");
    await userEvent.click(screen.getByRole("button", { name: "Crear usuario" }));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/users",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const body = lastPostBody();
    expect(body.role).toBe("USER");
    expect(body.section).toBe("11-1");
  });

  it("normaliza section=\"\" cuando el rol NO es Estudiante", async () => {
    render(<NewUserPage />);
    await fillRequired();
    await userEvent.selectOptions(screen.getByLabelText("Rol *"), "TEACHER");
    await userEvent.click(screen.getByRole("button", { name: "Crear usuario" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const body = lastPostBody();
    expect(body.role).toBe("TEACHER");
    expect(body.section).toBe("");
  });
});
