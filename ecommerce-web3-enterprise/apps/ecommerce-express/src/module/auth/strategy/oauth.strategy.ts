// oauth.strategy.ts => PATRÓN "Strategy" aplicado a proveedores OAuth2 externos + PATRÓN "Adapter".
// El flujo OAuth2 (redirect + intercambio del code) lo completa next-auth en el frontend. El backend
// recibe el ACCESS TOKEN del proveedor y lo VERIFICA llamando al endpoint "userinfo" del propio proveedor:
// si el token es falso o de otra app, el proveedor responde 401 y no se emite sesión (verificación sin confianza ciega).
// Antes se usaba passport-oauth2 aquí, lo que duplicaba el flujo que ya hace next-auth; además la Strategy
// genérica de passport-oauth2 no descarga el perfil, así que el email siempre llegaba vacío.
// Apple (RF-01.2) no tiene endpoint "userinfo": entrega un id_token (JWT RS256) que se verifica con las llaves públicas
// de Apple (JWKS) — firma, emisor, audiencia y vencimiento — sin librerías nuevas (node:crypto + jsonwebtoken).
import { createHmac, createPublicKey, type JsonWebKey } from "node:crypto"; // Módulo nativo de Node: HMAC y llaves JWK
import axios, { AxiosError } from "axios"; // Cliente HTTP (prescrito en el SETUP para APIs externas sin SDK)
import jwt from "jsonwebtoken"; // Verificación de JWT (ya usado para los tokens propios)
import type { OAuthProfile, OAuthProviderName } from "../types/auth.types";
import { OAuthVerificationException } from "../exception/auth.exception";
import { appConfig } from "../../../config/app.config";

// "interface" => contrato común de todas las estrategias (OCP: un 4º proveedor = una clase nueva que lo cumpla)
interface OAuthProfileStrategy {
  fetchProfile(accessToken: string): Promise<OAuthProfile>;
}

// Cliente HTTP con timeout: un proveedor lento no debe colgar el login indefinidamente
const http = axios.create({ timeout: 5000 });

// Helper: cabecera Bearer estándar de OAuth2
const bearer = (accessToken: string) => ({ headers: { Authorization: `Bearer ${accessToken}` } });

// Divide un nombre completo en nombre/apellido (Adapter para proveedores que solo entregan "name")
function splitName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  const [first = "Usuario", ...rest] = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  return { firstName: first, lastName: rest.join(" ") };
}

// --- Google (OpenID Connect userinfo) ---
class GoogleProfileStrategy implements OAuthProfileStrategy {
  public async fetchProfile(accessToken: string): Promise<OAuthProfile> {
    // "http.get<T>" => genérico: tipa la forma esperada de la respuesta JSON
    const { data } = await http.get<{
      sub: string;
      email?: string;
      email_verified?: boolean;
      given_name?: string;
      family_name?: string;
      name?: string;
      picture?: string;
    }>("https://openidconnect.googleapis.com/v1/userinfo", bearer(accessToken));

    const fallbackName = splitName(data.name);
    return {
      provider: "GOOGLE",
      providerAccountId: data.sub,
      email: data.email ?? "",
      emailVerified: data.email_verified === true,
      firstName: data.given_name ?? fallbackName.firstName,
      lastName: data.family_name ?? fallbackName.lastName,
      avatarUrl: data.picture,
    };
  }
}

// --- GitHub (el email puede ser privado: se consulta /user/emails para obtener el primario verificado) ---
class GitHubProfileStrategy implements OAuthProfileStrategy {
  public async fetchProfile(accessToken: string): Promise<OAuthProfile> {
    // "Promise.all" => ambas llamadas en paralelo (menor latencia del login)
    const [userResponse, emailsResponse] = await Promise.all([
      http.get<{ id: number; name: string | null; login: string; avatar_url?: string }>(
        "https://api.github.com/user",
        bearer(accessToken)
      ),
      http.get<Array<{ email: string; primary: boolean; verified: boolean }>>(
        "https://api.github.com/user/emails",
        bearer(accessToken)
      ),
    ]);

    // ".find" => primer email marcado como primario Y verificado
    const primary = emailsResponse.data.find((entry) => entry.primary && entry.verified);
    const { firstName, lastName } = splitName(userResponse.data.name ?? userResponse.data.login);
    return {
      provider: "GITHUB",
      providerAccountId: String(userResponse.data.id), // GitHub usa IDs numéricos: se normalizan a string
      email: primary?.email ?? "",
      emailVerified: Boolean(primary),
      firstName,
      lastName,
      avatarUrl: userResponse.data.avatar_url,
    };
  }
}

// --- Discord ---
class DiscordProfileStrategy implements OAuthProfileStrategy {
  public async fetchProfile(accessToken: string): Promise<OAuthProfile> {
    const { data } = await http.get<{
      id: string;
      email?: string;
      verified?: boolean;
      global_name?: string | null;
      username: string;
      avatar?: string | null;
    }>("https://discord.com/api/users/@me", bearer(accessToken));

    const { firstName, lastName } = splitName(data.global_name ?? data.username);
    return {
      provider: "DISCORD",
      providerAccountId: data.id,
      email: data.email ?? "",
      emailVerified: data.verified === true,
      firstName,
      lastName,
      // URL del CDN de Discord construida con el hash del avatar (si el usuario tiene uno)
      avatarUrl: data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png` : undefined,
    };
  }
}

// --- Facebook (Graph API /me) — RF-01.2 ---
// "appsecret_proof" = HMAC-SHA256(token, secreto de la app): Meta solo responde si el token pertenece a NUESTRA app
// (evita que un token emitido para otra aplicación sirva aquí). Meta solo entrega emails ya confirmados.
class FacebookProfileStrategy implements OAuthProfileStrategy {
  public async fetchProfile(accessToken: string): Promise<OAuthProfile> {
    const proof = appConfig.FACEBOOK_APP_SECRET ? createHmac("sha256", appConfig.FACEBOOK_APP_SECRET).update(accessToken).digest("hex") : undefined;
    const { data } = await http.get<{ id: string; email?: string; first_name?: string; last_name?: string; name?: string; picture?: { data?: { url?: string } } }>(
      `https://graph.facebook.com/${appConfig.META_GRAPH_VERSION}/me`,
      // "params" => query string; el spread condicional solo agrega appsecret_proof si hay secreto configurado
      { params: { fields: "id,email,first_name,last_name,name,picture.type(large)", access_token: accessToken, ...(proof ? { appsecret_proof: proof } : {}) } }
    );
    const fallbackName = splitName(data.name);
    return {
      provider: "FACEBOOK",
      providerAccountId: data.id,
      email: data.email ?? "",
      emailVerified: Boolean(data.email), // Graph API solo expone el email si está confirmado en Facebook
      firstName: data.first_name ?? fallbackName.firstName,
      lastName: data.last_name ?? fallbackName.lastName,
      avatarUrl: data.picture?.data?.url,
    };
  }
}

// --- Apple (Sign in with Apple) — RF-01.2 ---
// Recibe el id_token (no un access token): se valida localmente con la llave pública de Apple que indica su "kid"
const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_TTL_MS = 60 * 60_000; // Las llaves de Apple rotan poco: caché de 1 h (menos latencia y llamadas)
type AppleJwk = JsonWebKey & { kid: string }; // Intersección de tipos: JWK estándar + identificador de la llave
let appleKeys: { keys: AppleJwk[]; fetchedAt: number } | null = null; // Caché en memoria del módulo

// appleKey => llave pública por "kid"; recarga el JWKS si venció la caché o si Apple rotó a una llave nueva
async function appleKey(kid: string): Promise<JsonWebKey> {
  if (!appleKeys || Date.now() - appleKeys.fetchedAt > APPLE_JWKS_TTL_MS || !appleKeys.keys.some((key) => key.kid === kid)) {
    const { data } = await http.get<{ keys: AppleJwk[] }>(`${APPLE_ISSUER}/auth/keys`);
    appleKeys = { keys: data.keys, fetchedAt: Date.now() };
  }
  const key = appleKeys.keys.find((candidate) => candidate.kid === kid);
  if (!key) throw new OAuthVerificationException("llave de Apple desconocida");
  return key;
}

class AppleProfileStrategy implements OAuthProfileStrategy {
  public async fetchProfile(idToken: string): Promise<OAuthProfile> {
    if (!appConfig.APPLE_CLIENT_ID) throw new OAuthVerificationException("Sign in with Apple no está configurado");
    // "complete: true" => devuelve también el header (se necesita "kid" para elegir la llave)
    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded || typeof decoded.payload === "string" || !decoded.header.kid) throw new OAuthVerificationException("id_token de Apple inválido");
    // "createPublicKey({ format: "jwk" })" => convierte la JWK de Apple en una llave que entiende jsonwebtoken
    const publicKey = createPublicKey({ key: await appleKey(decoded.header.kid), format: "jwk" });
    // "jwt.verify" => valida firma RS256 + emisor + audiencia (nuestro Services ID) + vencimiento; lanza si algo falla
    const claims = jwt.verify(idToken, publicKey, { algorithms: ["RS256"], issuer: APPLE_ISSUER, audience: appConfig.APPLE_CLIENT_ID }) as {
      sub: string;
      email?: string;
      email_verified?: boolean | "true" | "false"; // Apple a veces lo envía como texto
    };
    return {
      provider: "APPLE",
      providerAccountId: claims.sub,
      email: claims.email ?? "",
      emailVerified: claims.email_verified === true || claims.email_verified === "true",
      // Apple envía el nombre solo en el PRIMER inicio y fuera del id_token: se usa la parte local del email
      ...splitName(claims.email?.split("@")[0]),
    };
  }
}

// Registro de estrategias (patrón Registry/Factory): nombre del proveedor -> implementación
// "Record<OAuthProviderName, ...>" => el compilador obliga a cubrir TODOS los proveedores (OCP: uno nuevo = una clase)
const strategies: Record<OAuthProviderName, OAuthProfileStrategy> = {
  GOOGLE: new GoogleProfileStrategy(),
  FACEBOOK: new FacebookProfileStrategy(),
  APPLE: new AppleProfileStrategy(),
  GITHUB: new GitHubProfileStrategy(),
  DISCORD: new DiscordProfileStrategy(),
};

// verifyOAuthAccessToken => punto de entrada único usado por AuthService (Facade)
export async function verifyOAuthAccessToken(provider: OAuthProviderName, accessToken: string): Promise<OAuthProfile> {
  try {
    const profile = await strategies[provider].fetchProfile(accessToken);
    // Sin email no se puede crear ni vincular una cuenta de forma segura
    if (!profile.email) throw new OAuthVerificationException("el proveedor no entregó un email");
    return { ...profile, email: profile.email.toLowerCase() };
  } catch (error) {
    if (error instanceof OAuthVerificationException) throw error;
    // "instanceof AxiosError" => el proveedor rechazó el token (401/403) o no respondió a tiempo;
    // "JsonWebTokenError" => id_token de Apple con firma, audiencia o vigencia inválidas
    const reason = error instanceof AxiosError ? `respuesta ${error.response?.status ?? "sin respuesta"}` : error instanceof jwt.JsonWebTokenError ? error.message : "error desconocido";
    throw new OAuthVerificationException(reason);
  }
}
