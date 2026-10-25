import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { PORTAL_PREFIXES } from "./lib/constants";
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
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer:
        process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ??
        `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ?? "common"}/v2.0`,
    }),
  ],
  callbacks: {
    // [authorized]: usado por proxy.ts para gatekeep edge sin DB | [Principio]: SRP
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const AUTH_PAGES = ["/login", "/register"];
      const isLogged = !!auth?.accessToken && auth.error !== "RefreshAccessTokenError";

      // [SSOT]: mismos prefijos que proxy.ts (antes lista duplicada y desincronizada) | [Principio]: DRY
      if (PORTAL_PREFIXES.some((p) => pathname.startsWith(p))) return isLogged;
      if (AUTH_PAGES.some((p) => pathname.startsWith(p)) && isLogged) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
