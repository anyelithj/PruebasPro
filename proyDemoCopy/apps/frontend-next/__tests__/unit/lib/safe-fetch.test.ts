// [Test anti-SSRF]: direcciones internas bloqueadas y públicas permitidas | node:net está disponible también bajo jsdom (Jest corre en Node)
import { isBlockedAddress, robotsAllows, safeFetch } from "@/lib/safe-fetch";

describe("isBlockedAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.9", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fc00::5", "::ffff:10.0.0.1"])("bloquea %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });
  it.each(["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111"])("permite %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(false);
  });
});

describe("safeFetch (validaciones previas a la red)", () => {
  it("rechaza protocolos, puertos y hosts no permitidos", async () => {
    await expect(safeFetch("file:///etc/passwd")).rejects.toThrow(/http o https/);
    await expect(safeFetch("http://example.com:4000/")).rejects.toThrow(/puertos/);
    await expect(safeFetch("http://127.0.0.1/")).rejects.toThrow(/red privada/);
    await expect(safeFetch("http://user:pass@example.com/")).rejects.toThrow(/usuario/);
  });
});

// [Tarea 9 · RF-139]: el importador respeta robots.txt (regla más específica gana) y el Crawl-delay
describe("robotsAllows", () => {
  const robots = ["User-agent: *", "Disallow: /privado/", "Allow: /privado/publico", "Crawl-delay: 5", "", "User-agent: AulaDeIdiomas-Importador", "Disallow: /no-aula"].join("\n");

  it("sin robots.txt todo está permitido", () => {
    expect(robotsAllows("", "/lo-que-sea")).toEqual({ allowed: true, crawlDelayMs: 0 });
  });
  it("nuestro grupo manda sobre «*»", () => {
    expect(robotsAllows(robots, "/no-aula/x").allowed).toBe(false);
    expect(robotsAllows(robots, "/privado/x").allowed).toBe(true); // «*» no aplica: existe un grupo con nuestro nombre
  });
  it("con el grupo «*»: Disallow y Allow más específico, y Crawl-delay en ms", () => {
    expect(robotsAllows(robots, "/privado/x", "otro-bot")).toEqual({ allowed: false, crawlDelayMs: 5000 });
    expect(robotsAllows(robots, "/privado/publico/a", "otro-bot").allowed).toBe(true);
    expect(robotsAllows(robots, "/gramatica", "otro-bot").allowed).toBe(true);
  });
});
