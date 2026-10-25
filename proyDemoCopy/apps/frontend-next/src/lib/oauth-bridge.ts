import { apiUrl, Role } from "./constants";
// [BFF bridge → NestJS]: cliente server-only para /auth/oauth + /auth/refresh + /auth/login | [Patrón]: Anti-Corruption Layer | [Principio]: SRP

// [Tipos]: forma del AuthResponseDto del backend | [Principio]: SSOT
export interface BackendAuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isEmailVerified: boolean;
}

export interface BackendAuthResponse {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  tokenType: "Bearer";
  user: BackendAuthUser;
}

export type OAuthProviderId = "google" | "microsoft";

export interface OAuthBridgeInput {
  provider: OAuthProviderId;
  providerAccountId: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

// [Headers BFF]: bridge secret obligatorio. Throw temprano si falta config
function bridgeHeaders(): HeadersInit {
  const secret = process.env.OAUTH_BRIDGE_SECRET;
  if (!secret) throw new Error("OAUTH_BRIDGE_SECRET no configurado en el server Next.js");
  return {
    "Content-Type": "application/json",
    "x-oauth-bridge-secret": secret,
  };
}

// [Helper desempaquetado]: maneja envelope { data } o body crudo | [Principio]: DRY
async function unwrap<T>(res: Response): Promise<T> {
  const text = await res.text();
  const parsed: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg =
      (parsed as { message?: string | string[] } | null)?.message ?? `HTTP ${res.status}`;
    throw new Error(Array.isArray(msg) ? msg.join(", ") : msg);
  }
  const envelope = parsed as { data?: T } | null;
  return (envelope?.data ?? (parsed as T)) as T;
}

// [exchangeOAuth]: BFF → POST /auth/oauth → AuthResponseDto | [Principio]: SRP
export async function exchangeOAuth(
  input: OAuthBridgeInput,
): Promise<BackendAuthResponse> {
  const res = await fetch(apiUrl("/auth/oauth"), {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify(input),
    cache: "no-store",
  });
  return unwrap<BackendAuthResponse>(res);
}

// [loginWithCredentials]: BFF → POST /auth/login. Para Credentials provider de Auth.js | [Principio]: SRP
export async function loginWithCredentials(
  email: string,
  password: string,
): Promise<BackendAuthResponse> {
  const res = await fetch(apiUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  return unwrap<BackendAuthResponse>(res);
}

// [refreshTokens]: BFF → POST /auth/refresh. Usado en callback jwt cuando expira el access
export async function refreshTokens(refreshToken: string): Promise<BackendAuthResponse> {
  const res = await fetch(apiUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });
  return unwrap<BackendAuthResponse>(res);
}

// [revokeRefresh]: BFF → POST /auth/logout. Idempotente
export async function revokeRefresh(refreshToken: string): Promise<void> {
  try {
    await fetch(apiUrl("/auth/logout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
  } catch {
    // [Tolerante]: no bloquear logout si backend caído
  }
}
