/** @jest-environment node */
import { isRefreshRefused, refreshOnce } from "@/lib/token-refresh";
import { apiFetch } from "@/lib/api-client";
import { ApiError } from "@/lib/errors";
import { safeReturnPath } from "@/lib/safe-return";
// [token-refresh · 2026-10-31]: refresh de un solo uso → varias peticiones simultáneas comparten una rotación; un fallo no se recuerda | [Herramienta]: Jest

jest.mock("@/lib/api-client", () => ({ apiFetch: jest.fn() }));
const api = apiFetch as jest.Mock;
const pair = { accessToken: "a2", refreshToken: "r2", accessExpiresIn: 900 };

beforeEach(() => api.mockReset());

it("peticiones simultáneas y tardías con la misma cookie reciben el mismo par con UNA sola rotación", async () => {
  api.mockResolvedValue(pair);
  const [a, b] = await Promise.all([refreshOnce("r-simultaneo"), refreshOnce("r-simultaneo")]);
  const late = await refreshOnce("r-simultaneo"); // Salió con la cookie vieja y llegó tras la rotación
  expect([a, b, late]).toEqual([pair, pair, pair]);
  expect(api).toHaveBeenCalledTimes(1);
});

it("un refresh rechazado no se recuerda: la siguiente petición reintenta", async () => {
  api.mockRejectedValueOnce(new Error("Session not active")).mockResolvedValueOnce(pair);
  await expect(refreshOnce("r-fallo")).rejects.toThrow("Session not active");
  await expect(refreshOnce("r-fallo")).resolves.toEqual(pair);
  expect(api).toHaveBeenCalledTimes(2);
});

it("solo un rechazo de NestJS termina la sesión; backend caído o saturado no", () => {
  for (const status of [400, 401, 403]) expect(isRefreshRefused(new ApiError(status, "x"))).toBe(true);
  for (const status of [408, 429, 500, 503, 504]) expect(isRefreshRefused(new ApiError(status, "x"))).toBe(false);
  expect(isRefreshRefused(new TypeError("fetch failed"))).toBe(false);
});

it("safeReturnPath solo acepta rutas internas (sin redirección abierta)", () => {
  expect(safeReturnPath("/practica?id=1")).toBe("/practica?id=1");
  for (const bad of [null, "", "https://evil.test", "//evil.test", "/\\evil.test", "/login"]) expect(safeReturnPath(bad)).toBeNull();
});
