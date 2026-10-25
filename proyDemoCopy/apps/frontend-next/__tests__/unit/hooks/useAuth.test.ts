// [Test useAuth]: facade login/register/logout sobre Redux + fetch | [Patrón]: Hook Test | [Principio]: Determinista
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "@/hooks/useAuth";
import { makeTestStore, makeStoreWrapper } from "../test-utils";

// [mock next/navigation]: capturamos router.push | [Patrón]: Mock
const pushMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// [helper render]: monta el hook con un store fresco por test
const setup = () => {
  const store = makeTestStore();
  const wrapper = makeStoreWrapper(store);
  const { result } = renderHook(() => useAuth(), { wrapper });
  return { result, store };
};

describe("useAuth", () => {
  beforeEach(() => {
    pushMock.mockClear();
    global.fetch = jest.fn();
  });
  afterEach(() => jest.restoreAllMocks());

  it("estado inicial: no autenticado, no cargando", () => {
    const { result } = setup();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("login exitoso guarda user, autentica y navega al dashboard", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: { id: "u1", email: "a@b.com" } }),
    });
    const { result } = setup();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.login({ email: "a@b.com", password: "secret12" });
    });
    expect(ok).toBe(true);
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("login fallido (res !ok) registra error y no navega", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Credenciales inválidas" }),
    });
    const { result } = setup();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.login({ email: "a@b.com", password: "bad" });
    });
    expect(ok).toBe(false);
    await waitFor(() => expect(result.current.error).toBe("Credenciales inválidas"));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("login con fallo de red captura la excepción y no rompe", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network down"));
    const { result } = setup();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.login({ email: "a@b.com", password: "secret12" });
    });
    expect(ok).toBe(false);
    await waitFor(() => expect(result.current.error).toBe("network down"));
  });

  it("register exitoso autentica y navega", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: { id: "u2", email: "new@b.com" } }),
    });
    const { result } = setup();
    await act(async () => {
      await result.current.register({
        email: "new@b.com",
        password: "Secret12",
        firstName: "Ada",
        lastName: "L",
      });
    });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("logout limpia estado y redirige a login (tolerante a fallo de red)", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("offline"));
    const { result } = setup();
    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.isAuthenticated).toBe(false);
    expect(pushMock).toHaveBeenCalledWith("/login");
  });
});
