// [Test LoginForm]: form RHF + Zod + useAuth | [Patrón]: Component Test | [Principio]: Determinista
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/auth/LoginForm";
import { makeTestStore, makeStoreWrapper } from "../../test-utils";

// [mock next/navigation]: el hook useAuth usa useRouter
const pushMock = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }), useSearchParams: () => new URLSearchParams() })); // [Sprint 7.18]: el login lee ?magic=invalid

// [mock server actions OAuth]: evita resolver módulo server-only en jsdom
jest.mock("@/app/(auth)/login/oauth-actions", () => ({
  signInWithGoogle: jest.fn(),
}));

const renderForm = () => {
  const store = makeTestStore();
  const Wrapper = makeStoreWrapper(store);
  return render(
    <Wrapper>
      <LoginForm />
    </Wrapper>,
  );
};

describe("LoginForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
    global.fetch = jest.fn();
  });
  afterEach(() => jest.restoreAllMocks());

  it("renderiza email, contraseña y botón de envío", () => {
    renderForm();
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
  });

  it("muestra errores de validación Zod al enviar vacío", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(await screen.findByText("El correo es obligatorio")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("envía credenciales válidas a /api/auth/login", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: { id: "u1" } }),
    });
    renderForm();
    await userEvent.type(screen.getByLabelText("Correo electrónico"), "user@test.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "secret12");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("muestra alerta de error cuando el login falla", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Credenciales inválidas" }),
    });
    renderForm();
    await userEvent.type(screen.getByLabelText("Correo electrónico"), "user@test.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "secret12");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciales inválidas");
  });
});
