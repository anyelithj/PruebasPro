import { streamToBackend } from "@/lib/stream-proxy";
// [Route Handler /api/audio · Sprint 4.7]: audio de pronunciación cacheado en el servidor (espeak-ng + MinIO), en streaming con Range | [Patrón]: BFF + Proxy | [Principio]: DRY (mismo proxy que los videos de cursos)
// El token viaja desde la cookie httpOnly al backend; el navegador nunca lo ve

export async function GET(request: Request) {
  const { search } = new URL(request.url); // `URL` (WHATWG): conserva ?text=…&language=…&variant=… tal cual
  return streamToBackend(request, `/audio${search}`);
}
