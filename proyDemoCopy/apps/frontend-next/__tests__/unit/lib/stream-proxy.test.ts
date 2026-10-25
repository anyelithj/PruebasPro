/**
 * @jest-environment node
 */
// [Test streamToBackend · Sprint 6.7]: la 302 del backend hacia la URL firmada de S3/R2 llega al navegador (Next no la sigue ni transporta los bytes) | [Patrón]: Unit Test con Mock (fetch y sesión) | [Principio]: KISS
import { streamToBackend } from "@/lib/stream-proxy";

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
});
