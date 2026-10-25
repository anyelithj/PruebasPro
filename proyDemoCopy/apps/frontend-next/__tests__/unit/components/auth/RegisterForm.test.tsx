// [Test RegisterForm]: form RHF + Zod + useAuth | [Patrón]: Component Test | [Principio]: Determinista
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { makeTestStore, makeStoreWrapper } from "../../test-utils";

const pushMock = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
jest.mock("@/app/(auth)/login/oauth-actions", () => ({
  signInWithGoogle: jest.fn(),
}));

const renderForm = () => {
  const store = makeTestStore();
  const Wrapper = makeStoreWrapper(store);
  return render(
    <Wrapper>
      <RegisterForm />
    </Wrapper>,
  );
};

describe("RegisterForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
    global.fetch = jest.fn();
  });
  afterEach(() => jest.restoreAllMocks());

  it("renderiza todos los campos del registro", () => {
    renderForm();
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    expect(screen.getByLabelText("Apellido")).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeInTheDocument();
  });

  it("muestra errores de validación al enviar vacío", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByText("El nombre es obligatorio")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("valida que las contraseñas coincidan", async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText("Nombre"), "Ada");
    await userEvent.type(screen.getByLabelText("Apellido"), "Lovelace");
    await userEvent.type(screen.getByLabelText("Correo electrónico"), "ada@test.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "Secret12");
    await userEvent.type(screen.getByLabelText("Confirmar"), "Distinta9A");
    await userEvent.click(screen.getByLabelText(/Acepto los/));
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByText("Las contraseñas no coinciden")).toBeInTheDocument();
  });

  it("envía un registro válido a /api/auth/register", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: { id: "u1" } }),
    });
    renderForm();
    await userEvent.type(screen.getByLabelText("Nombre"), "Ada");
    await userEvent.type(screen.getByLabelText("Apellido"), "Lovelace");
    await userEvent.type(screen.getByLabelText("Correo electrónico"), "ada@test.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "Secret12");
    await userEvent.type(screen.getByLabelText("Confirmar"), "Secret12");
    await userEvent.click(screen.getByLabelText(/Acepto los/));
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/register",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
});
