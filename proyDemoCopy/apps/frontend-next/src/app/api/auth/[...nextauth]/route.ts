import { handlers } from "@/lib/auth-nextauth";
// [Route Handler catch-all Auth.js v5]: expone /api/auth/signin, /callback/[provider], /signout, /csrf, etc.
// [Reemplaza stub previo]: Auth.js v5 + provider Google operativo (Microsoft retirado 2026-11-16).

export const { GET, POST } = handlers;
