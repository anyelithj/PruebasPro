import { request } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// [Playwright global-setup] — autentica como ADMIN contra el backend (:4000) y guarda
// un storageState con las cookies httpOnly que el middleware proxy.ts exige (neuroedu_access).
// El backend devuelve los tokens en el JSON (no Set-Cookie), por eso se arma el state a mano.

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:4000";
const PREFIX = process.env.API_PREFIX ?? "api/v1";
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@neuroedu.ia";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "StrongP@ss123";

// nombres de cookie: deben coincidir con COOKIE_NAMES en src/lib/constants.ts
const ACCESS_COOKIE = process.env.ACCESS_TOKEN_COOKIE ?? "neuroedu_access";
const REFRESH_COOKIE = process.env.REFRESH_TOKEN_COOKIE ?? "neuroedu_refresh";

export const STORAGE_STATE = path.join(__dirname, ".auth", "admin.json");

export default async function globalSetup(): Promise<void> {
  const ctx = await request.newContext();
  const url = `${BACKEND}/${PREFIX}/auth/login`;

  const res = await ctx.post(url, { data: { email: EMAIL, password: PASSWORD } });
  if (!res.ok()) {
    const txt = await res.text();
    throw new Error(
      `Login ADMIN falló (${res.status()}) en ${url}: ${txt}\n` +
        `Verifica: backend levantado en :4000 y seed corrido (cd apps/backend && pnpm seed). ` +
        `Creds usadas: ${EMAIL} (override con E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD).`,
    );
  }

  // el backend envuelve en { statusCode, data: {...} } (TransformInterceptor); tolera ambas formas
  const raw = (await res.json()) as {
    data?: { accessToken: string; refreshToken: string };
    accessToken?: string;
    refreshToken?: string;
  };
  const body = raw.data ?? (raw as { accessToken: string; refreshToken: string });
  if (!body.accessToken) {
    throw new Error(`Respuesta de login sin accessToken: ${JSON.stringify(raw)}`);
  }
  await ctx.dispose();

  // cookies host-only para localhost; el proxy solo checa presencia de neuroedu_access
  const expires = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // +1 día
  const cookie = (name: string, value: string) => ({
    name,
    value,
    domain: "localhost",
    path: "/",
    expires,
    httpOnly: true,
    secure: false,
    sameSite: "Lax" as const,
  });

  const state = {
    cookies: [
      cookie(ACCESS_COOKIE, body.accessToken),
      cookie(REFRESH_COOKIE, body.refreshToken),
    ],
    origins: [],
  };

  mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
  writeFileSync(STORAGE_STATE, JSON.stringify(state, null, 2), "utf-8");
}
