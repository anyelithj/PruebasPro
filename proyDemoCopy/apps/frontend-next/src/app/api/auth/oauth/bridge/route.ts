import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth, signOut } from "@/lib/auth-nextauth";
import { apiFetch } from "@/lib/api-client";
import { setAuthCookies, type AuthResponse } from "@/lib/auth";
import { PORTAL_ROUTES } from "@/lib/constants";
// [Bridge OAuth]: lee la sesión Auth.js post-callback, intercambia id_token por JWT propio en NestJS y setea cookies httpOnly | [Patrón]: Adapter + Anti-Corruption Layer | [Principio]: SRP

// [Mapeo provider Auth.js → backend]: 'microsoft-entra-id' → 'microsoft'
function mapProvider(p: string | undefined): "google" | "microsoft" | null {
  if (p === "google") return "google";
  if (p === "microsoft-entra-id") return "microsoft";
  return null;
}

// [GET]: Auth.js redirige aquí tras OAuth → exchange + cookies + redirect a dashboard
export async function GET(req: Request): Promise<NextResponse> {
  const session = await auth();
  const idToken = session?.idToken;
  const providerKey = mapProvider(session?.provider);

  if (!idToken || !providerKey) {
    const url = new URL("/login", req.url);
    url.searchParams.set("oauth_error", "missing_id_token");
    return NextResponse.redirect(url);
  }

  try {
    // [Exchange]: NestJS verifica id_token (Google/Microsoft JWKS), find-or-create user, emite par JWT propio
    const backend = await apiFetch<AuthResponse>("/auth/oauth", {
      method: "POST",
      body: { provider: providerKey, idToken },
    });
    // [Cookies httpOnly]: reutiliza pattern existente — proxy.ts ya lee neuroedu_access
    await setAuthCookies(backend);
    // [Cierra sesión Auth.js]: evita estado duplicado — único SSOT es la cookie de NestJS
    try {
      await signOut({ redirect: false });
    } catch {
      // [Tolerante]: si signOut server-action falla en route handler, limpia cookies manualmente abajo
      const store = await cookies();
      for (const c of store.getAll()) {
        if (c.name.includes("authjs") || c.name.includes("next-auth")) {
          store.delete(c.name);
        }
      }
    }
    return NextResponse.redirect(new URL(PORTAL_ROUTES.dashboard, req.url));
  } catch {
    const url = new URL("/login", req.url);
    url.searchParams.set("oauth_error", "exchange_failed");
    return NextResponse.redirect(url);
  }
}
