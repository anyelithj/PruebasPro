import { forward } from "@/lib/bff/forward";
// [Route Handler /api/[...path] · Sprint 6.2/6.4]: ruta comodín de los módulos nuevos → forward() | [Patrón]: BFF + Front Controller | [Principio]: DRY (un solo archivo para todas las rutas nuevas) + SRP
// [Next.js]: las rutas estáticas (p. ej. /api/notifications) tienen prioridad; este archivo solo atiende lo que ninguna otra ruta captura

// `force-dynamic` (Next.js): flujos SSE y estados de exportación nunca se cachean
export const dynamic = "force-dynamic";

// `Promise<{ path }>` (Next.js 15+): los params dinámicos se esperan
type Ctx = { params: Promise<{ path: string[] }> };

// [Handler único]: los cuatro verbos comparten la misma función | [Paradigma]: Funcional
async function handle(request: Request, { params }: Ctx): Promise<Response> {
  return forward(request, (await params).path);
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
