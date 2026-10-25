/**
 * @jest-environment node
 */
// [Entorno node]: Request/Response nativos de Node 18+ (jsdom no los trae) — igual que en el servidor de Next.js
// [Test forward()]: lista blanca de la ruta comodín /api/[...path] + cabeceras SSE | [Patrón]: Unit Test con Mock (jest.mock) | [Principio]: KISS
import { forward } from "@/lib/bff/forward";
import { streamToBackend } from "@/lib/stream-proxy";

// `jest.mock` (Jest): sustituye el proxy real → no hay red ni cookies en la prueba
jest.mock("@/lib/stream-proxy", () => ({ streamToBackend: jest.fn() }));
const proxy = streamToBackend as jest.MockedFunction<typeof streamToBackend>;

const req = (method: string, url = "http://localhost/api/x") => new Request(url, { method });

describe("forward (BFF comodín)", () => {
  beforeEach(() => proxy.mockReset());

  it("reenvía un prefijo permitido con su query string", async () => {
    proxy.mockResolvedValue(new Response("{}", { headers: { "content-type": "application/json" } }));
    await forward(req("GET", "http://localhost/api/reports/export/me?x=1"), ["reports", "export", "me"]);
    expect(proxy).toHaveBeenCalledWith(expect.any(Request), "/reports/export/me?x=1");
  });

  it("404 si el prefijo no está en la lista blanca o el segmento es sospechoso", async () => {
    expect((await forward(req("GET"), ["users"])).status).toBe(404);
    expect((await forward(req("GET"), ["reports", "export", ".."])).status).toBe(404);
    expect(proxy).not.toHaveBeenCalled();
  });

  it("405 si el método no está permitido", async () => {
    expect((await forward(req("POST"), ["notifications", "stream"])).status).toBe(405);
  });

  it("marca el flujo SSE como no transformable", async () => {
    proxy.mockResolvedValue(new Response("", { headers: { "content-type": "text/event-stream" } }));
    const res = await forward(req("GET"), ["notifications", "stream"]);
    expect(res.headers.get("cache-control")).toBe("no-cache, no-transform");
  });

  // [Sprint 8.16]: juegos, práctica y vocabulario reenviados; el audio de /speech se corta en el BFF si supera 10 MB (413) sin llegar a NestJS
  it("reenvía games, practice y vocabulary; speech solo POST", async () => {
    proxy.mockResolvedValue(new Response("{}", { headers: { "content-type": "application/json" } }));
    await forward(req("POST", "http://localhost/api/games/agent/turn"), ["games", "agent", "turn"]);
    await forward(req("PATCH", "http://localhost/api/practice/activities/a1"), ["practice", "activities", "a1"]);
    await forward(req("DELETE", "http://localhost/api/vocabulary/e1"), ["vocabulary", "e1"]);
    expect(proxy).toHaveBeenCalledTimes(3);
    expect((await forward(req("GET"), ["speech", "transcribe"])).status).toBe(405);
  });

  it("413 si la grabación declara más de 10 MB (no se reenvía)", async () => {
    const big = new Request("http://localhost/api/speech/transcribe", { method: "POST", headers: { "content-length": String(11 * 1024 * 1024) } });
    expect((await forward(big, ["speech", "transcribe"])).status).toBe(413);
    expect(proxy).not.toHaveBeenCalled();
  });

  // [Sprint 9.14]: música y diálogos — el audio conserva Range/206 tal cual llega de NestJS y la subida se corta en 20 MB
  it("reenvía music y dialogues conservando el 206 del audio", async () => {
    proxy.mockResolvedValue(new Response("abc", { status: 206, headers: { "content-type": "audio/mpeg", "content-range": "bytes 0-2/10" } }));
    const res = await forward(req("GET", "http://localhost/api/music/songs/s1/audio"), ["music", "songs", "s1", "audio"]);
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 0-2/10");
    await forward(req("POST", "http://localhost/api/dialogues/sessions/d1/turns"), ["dialogues", "sessions", "d1", "turns"]);
    expect(proxy).toHaveBeenCalledTimes(2);
  });

  it("413 si la canción declara más de 20 MB", async () => {
    const big = new Request("http://localhost/api/music/songs/s1/audio", { method: "POST", headers: { "content-length": String(21 * 1024 * 1024) } });
    expect((await forward(big, ["music", "songs", "s1", "audio"])).status).toBe(413);
    expect(proxy).not.toHaveBeenCalled();
  });

  // [Sprints 10.2/10.13]: poliglota, gramática y el diccionario («Aprender» va por /vocabulary/words)
  it("reenvía polyglot, grammar y vocabulary/words", async () => {
    proxy.mockResolvedValue(new Response("{}", { headers: { "content-type": "application/json" } }));
    await forward(req("GET", "http://localhost/api/polyglot/table?topic=t1&languages=en,es"), ["polyglot", "table"]);
    await forward(req("POST", "http://localhost/api/grammar/topics/draft"), ["grammar", "topics", "draft"]);
    await forward(req("PATCH", "http://localhost/api/vocabulary/words/w1/status"), ["vocabulary", "words", "w1", "status"]);
    expect(proxy).toHaveBeenNthCalledWith(1, expect.any(Request), "/polyglot/table?topic=t1&languages=en,es");
    expect(proxy).toHaveBeenCalledTimes(3);
  });
});
