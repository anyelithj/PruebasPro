import NextAuth from "next-auth";
import { authConfig } from "./auth-config";
// [Inicialización Auth.js]: expone handlers (route), auth (server session), signIn/signOut (server actions) | [Patrón]: Facade | [Principio]: SSOT
// [Nota]: archivo Node-runtime — NO importar en proxy.ts (edge). Si se necesita en proxy.ts, usar authConfig directo sin callbacks que hagan fetch.

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
