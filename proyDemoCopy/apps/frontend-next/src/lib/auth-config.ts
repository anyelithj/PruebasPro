import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
// [Configuración Auth.js v5]: providers OAuth + callbacks mínimos para flujo bridge | [Patrón]: Configuration Object | [Principio]: SSOT | [Paradigma]: Funcional
// [Nota arquitectónica]: Auth.js se usa SOLO para el handshake OAuth. La sesión real vive en cookies httpOnly de NestJS (lib/auth.ts) — bridge route copia el id_token a backend y setea esas cookies.

// [Resolución env]: soporta convención AUTH_* (Auth.js v5) y legacy *_CLIENT_ID | [Principio]: DRY + Backward-compat
const googleClientId =
  process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID ?? "";
const googleClientSecret =
  process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? "";

// [Provider Google]
const google = Google({
  clientId: googleClientId,
  clientSecret: googleClientSecret,
  authorization: {
    params: { scope: "openid email profile", prompt: "select_account" },
  },
});

export const authConfig: NextAuthConfig = {
  providers: [google], // [2026-11-16]: solo Google (Microsoft retirado)
  // [pages]: cualquier error de OAuth lleva a /login con ?error=...
  pages: { signIn: "/login", error: "/login" },
  // [session]: TTL corto — Auth.js solo retiene el id_token entre callback OAuth y bridge route
  session: { strategy: "jwt", maxAge: 60 * 10 },
  // [trustHost]: requerido en entornos detrás de proxy/reverse-proxy (Next 16 producción)
  trustHost: true,
  callbacks: {
    // [jwt callback]: en sign-in OAuth, account.id_token está presente — lo guardamos para el bridge
    async jwt({ token, account }) {
      if (account?.id_token) {
        token.idToken = account.id_token;
        token.provider = account.provider;
      }
      return token;
    },
    // [session callback]: expone id_token + provider al server (auth() en bridge)
    async session({ session, token }) {
      session.idToken = token.idToken as string | undefined;
      session.provider = token.provider as string | undefined;
      return session;
    },
  },
};
