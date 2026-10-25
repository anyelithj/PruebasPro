import "next-auth"; // [TS]: importa el módulo para poder ampliarlo (augmentation requiere que el archivo sea un módulo)
import "next-auth/jwt";
import type { Role } from "@/lib/constants"; // `import type` (TS): solo tipos, se borra al compilar
// [Augmentation Auth.js v5]: extiende User, Session y JWT con los campos custom que usan auth.ts / auth.config.ts / bridge | [Patrón]: Module Augmentation | [Principio]: SSOT tipos + Type-Safe
// [Fix]: antes solo declaraba idToken/provider → 12 errores TS en auth.ts y auth.config.ts (accessToken, role, error… no existían)

// `declare module` (TS): fusiona estas interfaces con las originales de la librería (declaration merging)
declare module "next-auth" {
  // [User]: lo que devuelve authorize()/toUser() tras login contra NestJS
  interface User {
    role?: Role; // `?` (TS): opcional → usuarios OAuth aún no enlazados no lo traen
    firstName?: string | null;
    lastName?: string | null;
  }

  // [Session]: shape pública expuesta al cliente (sin refreshToken por seguridad)
  interface Session {
    idToken?: string;
    provider?: string;
    accessToken?: string; // Bearer para llamar al backend
    accessTokenExpires?: number; // epoch ms
    error?: "RefreshAccessTokenError"; // [Union literal]: único error conocido → el proxy fuerza re-login
  }
}

declare module "next-auth/jwt" {
  // [JWT]: token cifrado en cookie; aquí sí vive el refreshToken
  interface JWT {
    idToken?: string;
    provider?: string;
    userId: string; // requerido: session() lo copia a session.user.id (string)
    role?: Role;
    firstName?: string | null;
    lastName?: string | null;
    accessToken: string; // requerido: refreshTokens(token.refreshToken) espera string
    refreshToken: string;
    accessTokenExpires: number;
    error?: "RefreshAccessTokenError";
  }
}
