import { render, waitFor } from "@testing-library/react";
import { SessionWatcher } from "@/components/auth/SessionWatcher";
// [SessionWatcher · 2026-10-31]: un 401 de /api comprueba la sesión al momento, sin alterar la respuesta | [Patrón]: Test Double (fetch falso) | [Herramienta]: Jest + Testing Library

const reply = (url: string, status: number) => ({ url: `http://localhost${url}`, status, redirected: false }) as Response;
const sessionChecks = (native: jest.Mock) => native.mock.calls.filter(([url]) => url === "/api/auth/me").length;

describe("SessionWatcher", () => {
  const original = window.fetch;
  afterEach(() => {
    window.fetch = original;
  });

  it("401 de /api → comprueba la sesión y devuelve la respuesta intacta", async () => {
    const native = jest.fn(async (url: string) => (url === "/api/auth/me" ? reply(url, 200) : reply(url, 401)));
    window.fetch = native as unknown as typeof fetch;
    render(<SessionWatcher />);
    const res = await window.fetch("/api/quiz");
    expect(res.status).toBe(401);
    await waitFor(() => expect(sessionChecks(native)).toBe(1));
  });

  it("respuesta correcta o 401 fuera de /api → no comprueba la sesión", async () => {
    const native = jest.fn(async (url: string) => reply(url, url === "/api/ok" ? 200 : 401));
    window.fetch = native as unknown as typeof fetch;
    const { unmount } = render(<SessionWatcher />);
    await window.fetch("/api/ok");
    await window.fetch("/externo");
    expect(sessionChecks(native)).toBe(0);
    unmount();
    expect(window.fetch).toBe(native); // Al desmontar se restaura el fetch original
  });
});
