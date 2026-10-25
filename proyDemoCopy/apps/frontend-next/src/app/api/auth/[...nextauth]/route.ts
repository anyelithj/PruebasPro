import { handlers } from "@/lib/auth-nextauth";
// [Route Handler catch-all Auth.js v5]: expone /api/auth/signin, /callback/[provider], /signout, /csrf, etc.
// [Reemplaza stub previo]: Auth.js v5 + provider Google + Microsoft Entra ID ya operativos.

export const { GET, POST } = handlers;
