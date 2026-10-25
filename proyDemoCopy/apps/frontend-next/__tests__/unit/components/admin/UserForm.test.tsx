// [Test UserForm]: formulario único de usuario (alta y edición) — campo Sección visible SOLO para rol Estudiante (USER) | [Patrón]: Component Test | [Principio]: Determinista
// [Cobertura corrección 2026-06-01]: section condicional por rol + normalización en submit (section="" si no es estudiante)
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserForm } from "@/app/(portal)/admin/users/UserForm";

const pushMock = jest.fn();
const refreshMock = jest.fn();
const backMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock, back: backMock }),
}));

const base = { id: "u1", email: "ada@example.com", firstName: "Ada", lastName: "Lovelace" } as const;

const lastPatchBody = () => {
  const call = (global.fetch as jest.Mock).mock.calls.at(-1)!;
  return JSON.parse(call[1].body as string);
};

describe("UserForm (edición) · campo Sección por rol", () => {
  beforeEach(() => {
    pushMock.mockClear();
    refreshMock.mockClear();
    backMock.mockClear();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "u1" }) });
  });
  afterEach(() => jest.restoreAllMocks());

  it("muestra Sección cuando el usuario es Estudiante (USER)", () => {
    render(<UserForm initial={{ ...base, role: "USER", section: "A" }} />);
    expect(screen.getByLabelText("Sección")).toHaveValue("A");
  });

  it("oculta Sección cuando el usuario es Docente o Administrador", () => {
    const { rerender } = render(<UserForm initial={{ ...base, role: "TEACHER" }} />);
    expect(screen.queryByLabelText("Sección")).not.toBeInTheDocument();
    rerender(<UserForm initial={{ ...base, role: "ADMIN" }} />);
    expect(screen.queryByLabelText("Sección")).not.toBeInTheDocument();
  });

  it("oculta Sección al cambiar el rol de Estudiante a Docente", async () => {
    render(<UserForm initial={{ ...base, role: "USER", section: "A" }} />);
    expect(screen.getByLabelText("Sección")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Rol *"), "TEACHER");
    expect(screen.queryByLabelText("Sección")).not.toBeInTheDocument();
  });

  it("al guardar con rol no-Estudiante envía section=\"\" (PATCH)", async () => {
    render(<UserForm initial={{ ...base, role: "USER", section: "A" }} />);
    await userEvent.selectOptions(screen.getByLabelText("Rol *"), "TEACHER");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/users/u1",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    const body = lastPatchBody();
    expect(body.role).toBe("TEACHER");
    expect(body.section).toBe("");
  });
});

describe("UserForm (alta)", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "new" }) });
  });

  it("pide contraseña y hace POST; en edición la contraseña no aparece", async () => {
    const { unmount } = render(<UserForm />);
    await userEvent.type(screen.getByLabelText("Nombre *"), "Ada");
    await userEvent.type(screen.getByLabelText("Apellido *"), "Lovelace");
    await userEvent.type(screen.getByLabelText("Email *"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Contraseña *"), "Secreta123");
    await userEvent.click(screen.getByRole("button", { name: "Crear usuario" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/admin/users", expect.objectContaining({ method: "POST" })));
    unmount();
    render(<UserForm initial={{ ...base, role: "USER" }} />);
    expect(screen.queryByLabelText("Contraseña *")).not.toBeInTheDocument();
  });
});
