/**
 * @jest-environment node
 */
// [Test streamToBackend · Sprint 6.7]: la 302 del backend hacia la URL firmada de S3/R2 llega al navegador (Next no la sigue ni transporta los bytes) | [Patrón]: Unit Test con Mock (fetch y sesión) | [Principio]: KISS
import { isRetryableNetworkError, streamToBackend } from "@/lib/stream-proxy";

jest.mock("@/lib/auth", () => ({ getFreshAccessToken: jest.fn().mockResolvedValue("jwt") }));

describe("streamToBackend", () => {
  const fetchMock = jest.fn();
  beforeAll(() => {
    global.fetch = fetchMock as unknown as typeof fetch; // `global.fetch` (Node 18+): se sustituye por el doble de prueba
  });

  it("pide la respuesta sin seguir redirecciones y reenvía Location", async () => {
    const signed = "https://aula.acc.r2.cloudflarestorage.com/course-materials/k?X-Amz-Signature=abc";
    fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { location: signed, "cache-control": "private, no-store" } }));
    const res = await streamToBackend(new Request("http://localhost/api/courses/c/materials/m/file", { headers: { range: "bytes=0-" } }), "/courses/c/materials/m/file");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.redirect).toBe("manual");
    expect(new Headers(init.headers).get("range")).toBe("bytes=0-");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(signed);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  // [2026-10-24]: `fetch failed` con causa ECONNRESET (socket keep-alive caducado) → un reintento con el cuerpo JSON en memoria
  const resetError = () => Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("aborted"), { code: "ECONNRESET" }) });
  const jsonPost = () => new Request("http://localhost/api/vocabulary/lookup/topic", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic: "la maison", language: "fr" }) });

  it("reintenta una vez un POST JSON tras ECONNRESET y reenvía el mismo cuerpo", async () => {
    fetchMock.mockReset();
    fetchMock.mockRejectedValueOnce(resetError()).mockResolvedValueOnce(new Response("{}", { status: 201, headers: { "content-type": "application/json" } }));
    const res = await streamToBackend(jsonPost(), "/vocabulary/lookup/topic");
    expect(res.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = (fetchMock.mock.calls[1][1] as RequestInit).body as ArrayBuffer;
    expect(new TextDecoder().decode(body)).toContain("la maison");
  });

  it("devuelve 502 JSON (no lanza) si el backend sigue sin responder", async () => {
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(resetError());
    const res = await streamToBackend(jsonPost(), "/vocabulary/lookup/topic");
    expect(res.status).toBe(502);
    expect((await res.json()).message).toMatch(/servidor/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("no reintenta subidas en streaming (multipart)", async () => {
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(resetError());
    const upload = new Request("http://localhost/api/speech/transcribe", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" }, body: "--x--" });
    const res = await streamToBackend(upload, "/speech/transcribe");
    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1] as RequestInit & { duplex?: string }).duplex).toBe("half");
  });

  it("isRetryableNetworkError: solo errores de transporte", () => {
    expect(isRetryableNetworkError(resetError())).toBe(true);
    expect(isRetryableNetworkError(new Error("boom"))).toBe(false);
    expect(isRetryableNetworkError(Object.assign(new Error("x"), { name: "AbortError" }))).toBe(false);
  });
});
