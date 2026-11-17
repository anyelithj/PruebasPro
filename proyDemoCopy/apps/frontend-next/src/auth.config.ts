import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { isProtectedPath } from "./lib/constants";
// [Auth.js v5 config edge-safe]: providers OAuth + matchers para proxy edge | [Patrón]: Strategy | [Principio]: SRP
// [Nota]: nada que dependa de Node-only APIs (crypto, fs, etc). Credentials provider y callbacks que hacen fetch al backend viven en auth.ts.

export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: { params: { prompt: "select_account" } },
    }),
    // [2026-11-16]: Microsoft Entra ID retirado → solo Google
  ],
  callbacks: {
    // [authorized]: usado por proxy.ts para gatekeep edge sin DB | [Principio]: SRP
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const AUTH_PAGES = ["/login", "/register"];
      const isLogged = !!auth?.accessToken && auth.error !== "RefreshAccessTokenError";

      // [SSOT]: mismos prefijos que proxy.ts (antes lista duplicada y desincronizada) | [Principio]: DRY
      if (isProtectedPath(pathname)) return isLogged; // [Caso E]: misma regla que proxy.ts (las rutas públicas ganan)
      if (AUTH_PAGES.some((p) => pathname.startsWith(p)) && isLogged) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
