import NextAuth, { type User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import {
  exchangeOAuth,
  loginWithCredentials,
  refreshTokens,
  revokeRefresh,
  type BackendAuthResponse,
  type OAuthProviderId,
} from "./lib/oauth-bridge";
// [Auth.js v5 root]: providers + callbacks JWT/session que delegan en NestJS | [Patrón]: Adapter + Strategy | [Principio]: DIP

// [Map provider id NextAuth → backend]: solo aceptamos los soportados | [Principio]: SSOT
const SUPPORTED_PROVIDERS: Record<string, OAuthProviderId> = {
  google: "google",
  "microsoft-entra-id": "microsoft",
};

// [toUser]: mapper BackendAuthResponse → User Auth.js | [Principio]: SRP
function toUser(payload: BackendAuthResponse): User & {
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: number;
} {
  return {
    id: payload.user.id,
    email: payload.user.email,
    firstName: payload.user.firstName,
    lastName: payload.user.lastName,
    role: payload.user.role,
    name: `${payload.user.firstName} ${payload.user.lastName}`.trim(),
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    accessTokenExpires: Date.now() + payload.accessExpiresIn * 1000,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;
        try {
          const payload = await loginWithCredentials(email, password);
          return toUser(payload);
        } catch {
          // [Mensaje genérico]: anti enumeration
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    // [signIn]: para OAuth, hace el bridge a NestJS y guarda tokens en el objeto user
    async signIn({ user, account, profile }) {
      if (!account || account.type !== "oauth") return true;

      const providerId = SUPPORTED_PROVIDERS[account.provider];
      if (!providerId) return false;

      const email = (user.email ?? profile?.email) as string | undefined;
      if (!email) return false;

      try {
        const payload = await exchangeOAuth({
          provider: providerId,
          providerAccountId: account.providerAccountId,
          email,
          firstName:
            (profile?.given_name as string | undefined) ??
            user.name?.split(" ")[0] ??
            undefined,
          lastName:
            (profile?.family_name as string | undefined) ??
            user.name?.split(" ").slice(1).join(" ") ??
            undefined,
        });

        // [Mutación user]: el callback jwt recibe estos campos en su user param
        Object.assign(user, {
          id: payload.user.id,
          role: payload.user.role,
          firstName: payload.user.firstName,
          lastName: payload.user.lastName,
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          accessTokenExpires: Date.now() + payload.accessExpiresIn * 1000,
        });
        return true;
      } catch {
        return false;
      }
    },

    // [jwt]: 1) primer login → copia tokens al JWT. 2) request siguiente → refresh si expirado
    async jwt({ token, user }) {
      // [Login inicial]: user solo viene en la primera invocación
      if (user) {
        const u = user as User & {
          id: string; // toUser() siempre asigna id (en Auth.js es opcional)
          accessToken: string;
          refreshToken: string;
          accessTokenExpires: number;
        };
        token.userId = u.id;
        token.role = u.role;
        token.firstName = u.firstName ?? null;
        token.lastName = u.lastName ?? null;
        token.accessToken = u.accessToken;
        token.refreshToken = u.refreshToken;
        token.accessTokenExpires = u.accessTokenExpires;
        token.error = undefined;
        return token;
      }

      // [Access todavía vivo]: pass-through
      if (Date.now() < token.accessTokenExpires - 30_000) return token;

      // [Rotación refresh]: backend revoca el viejo y emite nuevo par
      try {
        const refreshed = await refreshTokens(token.refreshToken);
        token.accessToken = refreshed.accessToken;
        token.refreshToken = refreshed.refreshToken;
        token.accessTokenExpires = Date.now() + refreshed.accessExpiresIn * 1000;
        token.error = undefined;
      } catch {
        token.error = "RefreshAccessTokenError";
      }
      return token;
    },

    // [session]: shape pública. NO incluir refreshToken (queda solo en JWT cifrado)
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.userId,
        role: token.role,
        firstName: token.firstName ?? null,
        lastName: token.lastName ?? null,
      };
      session.accessToken = token.accessToken;
      session.accessTokenExpires = token.accessTokenExpires;
      session.error = token.error;
      return session;
    },
  },
  events: {
    // [signOut]: revoca refresh en backend (best-effort) | [Principio]: SRP
    async signOut(message) {
      const refresh = "token" in message ? message.token?.refreshToken : undefined;
      if (typeof refresh === "string" && refresh) await revokeRefresh(refresh);
    },
  },
});
