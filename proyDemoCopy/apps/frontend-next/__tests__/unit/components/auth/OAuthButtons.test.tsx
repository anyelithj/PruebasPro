// [Test OAuthButtons]: botón Google (2026-10-24: Microsoft retirado) que disparan server actions | [Patrón]: Component Test
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// [mock server actions]: capturamos las llamadas y simulamos éxito/fallo
const signInWithGoogle = jest.fn();
jest.mock("@/app/(auth)/login/oauth-actions", () => ({
  signInWithGoogle: () => signInWithGoogle(),
}));

import { OAuthButtons } from "@/components/auth/OAuthButtons";

describe("OAuthButtons", () => {
  beforeEach(() => {
    signInWithGoogle.mockReset();
  });

  it("renderiza solo Google con etiqueta accesible (sin Microsoft)", () => {
    render(<OAuthButtons />);
    expect(screen.getByRole("button", { name: "Iniciar sesión con Google" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Iniciar sesión con Microsoft" })).toBeNull();
  });

  it("invoca la server action de Google al hacer click", async () => {
    signInWithGoogle.mockResolvedValueOnce(undefined);
    render(<OAuthButtons />);
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión con Google" }));
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(1));
  });

  it("muestra mensaje de error si la action lanza (no redirect)", async () => {
    signInWithGoogle.mockRejectedValueOnce(new Error("OAuth falló"));
    render(<OAuthButtons />);
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión con Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("OAuth falló");
  });
});
