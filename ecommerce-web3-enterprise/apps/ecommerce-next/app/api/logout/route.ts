// route.ts (GET /api/logout) => cierre de sesión ÚNICO para Next y Nuxt (SSO): revoca la sesión del backend
// (events.signOut) y vuelve a la landing de la tienda, sin pasar por la página genérica /api/auth/signout de next-auth.
// Sin la cookie de next-auth, el middleware de Nitro borra también la sesión de Nuxt en la siguiente página.
import { signOut } from "@/shared/lib/auth-config";
import { config } from "@/shared/constants/config";

export async function GET() {
  await signOut({ redirectTo: config.cmsUrl }); // Lanza la redirección (NEXT_REDIRECT) con las cookies ya borradas
}
