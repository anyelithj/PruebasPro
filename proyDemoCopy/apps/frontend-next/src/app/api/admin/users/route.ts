import { bffMutation } from "@/lib/bff";
import { createUser, type CreateUserInput } from "@/lib/quiz-api";
// [Route Handler /api/admin/users POST]: proxy creación usuario (ADMIN) | [Patron]: Proxy | [Principio]: SRP
// [2026-10-23]: vía bffMutation/bffQuery → refresca el access token vencido (antes respondía «Unauthorized») | [Patrón]: Proxy (BFF) + Template Method | [Principio]: DRY

export async function POST(request: Request) {
  return bffMutation(request, (body) => createUser(body as CreateUserInput), 201); // `as` (TS): el backend valida el DTO
}
