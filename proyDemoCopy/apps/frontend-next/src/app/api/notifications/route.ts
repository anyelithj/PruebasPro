import { apiFetch } from "@/lib/api-client";
import { getCurrentAccessToken } from "@/lib/auth";
import { bffMutation, bffQuery } from "@/lib/bff";
// [Route Handler /api/notifications]: campana del topbar → NestJS /notifications/me | [Patrón]: BFF | [Seguridad]: el JWT sale de la cookie httpOnly solo en el servidor

// [bearer]: token de la cookie (undefined si no hay sesión → el backend responde 401)
const bearer = async () => (await getCurrentAccessToken()) ?? undefined;

// GET → { items, unread }
export async function GET() {
  return bffQuery(async () => apiFetch("/notifications/me", { bearer: await bearer() }));
}

// PATCH → marca todas como leídas (el cuerpo se ignora; bffMutation exige JSON válido, se envía "{}")
export async function PATCH(request: Request) {
  return bffMutation(request, async () => apiFetch("/notifications/me/read", { method: "PATCH", bearer: await bearer() }));
}
