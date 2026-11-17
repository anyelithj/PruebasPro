// [Solo servidor]: usa módulos node:* (dns, http, net) → no puede empaquetarse para el navegador
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
// [safeFetch]: descarga una URL pública desde el servidor con protección SSRF (Server-Side Request Forgery)
// [Seguridad]: solo http/https y puertos 80/443 · la IP se valida EN la conexión (lookup propio → sin DNS rebinding) · redirecciones revalidadas (máx. 3) · tiempo y tamaño máximos
// [Patrón]: Guard + Adapter (node:http → resultado tipado) | [Principio]: Secure by default + SRP | [Paradigma]: Asíncrono (Promise + callbacks de Node)

const MAX_BYTES = 25 * 1024 * 1024; // [2026-10-23]: 25 MB (antes 5) → también MP3/MP4 por enlace para transcribir la letra
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

// [Cabeceras de navegador · 2026-10-23]: muchos sitios (CDN/WAF) responden 403 a agentes desconocidos («La página respondió con el código 403») → se identifica como un navegador normal | [Patrón]: Constant Object
const BROWSER_HEADERS = Object.freeze({
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 AulaDeIdiomas-Importador/1.1",
  Accept: "text/html,application/xhtml+xml,application/pdf,audio/*,video/*,text/plain,*/*;q=0.8",
  "Accept-Language": "es,en;q=0.9",
});

// [Rangos no públicos]: `net.BlockList` (Node.js) — loopback, redes privadas, link-local (metadatos cloud 169.254.169.254), CGNAT, multicast, reservados
const blocked = new net.BlockList();
for (const [addr, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4]] as const) {
  blocked.addSubnet(addr, prefix, "ipv4");
}
for (const [addr, prefix] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["64:ff9b::", 96]] as const) {
  blocked.addSubnet(addr, prefix, "ipv6");
}

// [isBlocked]: también IPv4 "mapeadas" en IPv6 (::ffff:10.0.0.1)
export function isBlockedAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return blocked.check(mapped[1], "ipv4");
  return blocked.check(address, net.isIPv6(address) ? "ipv6" : "ipv4");
}

// [guardedLookup]: resolución DNS que rechaza IPs no públicas ANTES de conectar | firma compatible con `lookup` de http.request
const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address))) return callback(new Error("BLOCKED_ADDRESS"), "", 4);
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

export interface SafeFetchResult {
  url: string; // URL final (tras redirecciones)
  contentType: string;
  body: Buffer;
}

// [safeFetch]: GET con los controles anteriores; lanza Error con mensaje legible
export function safeFetch(rawUrl: string, redirects = 0): Promise<SafeFetchResult> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return reject(new Error("El enlace no es una URL válida."));
    }
    if (!["http:", "https:"].includes(url.protocol)) return reject(new Error("Solo se admiten enlaces http o https."));
    if (url.port && !["80", "443"].includes(url.port)) return reject(new Error("Solo se admiten los puertos estándar (80/443)."));
    if (url.username || url.password) return reject(new Error("El enlace no puede incluir usuario o contraseña."));
    if (net.isIP(url.hostname.replace(/^\[|\]$/g, "")) && isBlockedAddress(url.hostname.replace(/^\[|\]$/g, ""))) return reject(new Error("Ese enlace apunta a una red privada y no está permitido."));

    const lib = url.protocol === "https:" ? https : http;
    const req = lib.get(url, { lookup: guardedLookup, timeout: TIMEOUT_MS, headers: BROWSER_HEADERS }, (res) => {
      const status = res.statusCode ?? 0;
      // [Redirección]: se revalida la nueva URL completa (protocolo, puerto e IP)
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
        res.resume(); // Descarta el cuerpo
        if (redirects >= MAX_REDIRECTS) return reject(new Error("Demasiadas redirecciones."));
        return resolve(safeFetch(new URL(res.headers.location, url).toString(), redirects + 1));
      }
      if (status < 200 || status >= 300) {
        res.resume();
        // [Mensaje accionable]: 401/403/429 = el sitio bloquea descargas automáticas → qué hacer en su lugar
        return reject(new Error([401, 403, 429].includes(status) ? `El sitio bloqueó la descarga automática (código ${status}). Descarga el archivo y súbelo, o copia y pega el texto.` : `La página respondió con el código ${status}.`));
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          req.destroy();
          return reject(new Error("La página o el archivo supera 25 MB."));
        }
        chunks.push(chunk);
      });
      res.on("end", () => resolve({ url: url.toString(), contentType: String(res.headers["content-type"] ?? ""), body: Buffer.concat(chunks) }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("La página tardó demasiado en responder.")));
    req.on("error", (err) => reject(err.message === "BLOCKED_ADDRESS" ? new Error("Ese enlace apunta a una red privada y no está permitido.") : err));
  });
}

// ───── [2026-11-13 · Tarea 9 · RF-139]: importador «educado» — respeta robots.txt y limita la frecuencia por sitio ─────
// [Patrón]: Decorator (politeFetch envuelve safeFetch: misma protección anti-SSRF) + Cache-Aside (robots.txt por origen) + Throttle
// [Principio]: SRP (reglas puras separadas de la red) + Secure by default | [Paradigma]: Funcional (robotsAllows es pura) + asíncrono

const ROBOTS_AGENT = "auladeidiomas-importador"; // Nombre con el que buscamos nuestro grupo en robots.txt (además de «*»)
const ROBOTS_TTL_MS = 60 * 60 * 1000; // robots.txt se relee como mucho cada hora por sitio
const MIN_INTERVAL_MS = 2_000; // Mínimo entre dos descargas al MISMO sitio (también se respeta Crawl-delay si es mayor)
const robotsCache = new Map<string, { text: string; at: number }>(); // `Map` (ES2015): origen → robots.txt | ponytail: en memoria por proceso; con varias réplicas → Redis
const lastHit = new Map<string, number>(); // origen → instante de la última descarga

// [robotsAllows]: ¿permite robots.txt leer `path`? Regla más específica (prefijo más largo) gana; a igual longitud gana Allow. Función pura.
export function robotsAllows(robots: string, path: string, agent = ROBOTS_AGENT): { allowed: boolean; crawlDelayMs: number } {
  type Group = { agents: string[]; rules: { allow: boolean; prefix: string }[]; delay: number };
  const groups: Group[] = [];
  let current: Group | null = null;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim(); // Sin comentarios
    const [key, ...rest] = line.split(":");
    const field = key?.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (!field) continue;
    if (field === "user-agent") {
      if (!current || current.rules.length || current.delay) groups.push((current = { agents: [], rules: [], delay: 0 })); // Agentes seguidos comparten grupo
      current.agents.push(value.toLowerCase());
    } else if (current && (field === "allow" || field === "disallow") && value) {
      current.rules.push({ allow: field === "allow", prefix: value.replace(/\*$/, "") });
    } else if (current && field === "crawl-delay") {
      current.delay = Math.max(0, Number(value) || 0) * 1000;
    }
  }
  // El grupo con nuestro nombre manda; si no hay, el de «*»
  const group = groups.find((g) => g.agents.some((a) => a !== "*" && agent.includes(a))) ?? groups.find((g) => g.agents.includes("*"));
  if (!group) return { allowed: true, crawlDelayMs: 0 };
  const match = group.rules.filter((r) => path.startsWith(r.prefix)).sort((a, b) => b.prefix.length - a.prefix.length || Number(b.allow) - Number(a.allow))[0];
  return { allowed: match ? match.allow : true, crawlDelayMs: group.delay };
}

async function robotsFor(origin: string): Promise<string> {
  const hit = robotsCache.get(origin);
  if (hit && Date.now() - hit.at < ROBOTS_TTL_MS) return hit.text;
  // Sin robots.txt (404, error de red) = sin restricciones; también pasa por safeFetch (anti-SSRF)
  const text = await safeFetch(`${origin}/robots.txt`).then((r) => (r.contentType.includes("text") ? r.body.toString("utf-8") : "")).catch(() => "");
  robotsCache.set(origin, { text, at: Date.now() });
  return text;
}

// [politeFetch]: safeFetch + robots.txt + espera mínima entre descargas al mismo sitio | lanza Error con mensaje legible
export async function politeFetch(rawUrl: string): Promise<SafeFetchResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("El enlace no es una URL válida.");
  }
  const rules = robotsAllows(await robotsFor(url.origin), url.pathname + url.search);
  if (!rules.allowed) throw new Error("El sitio no permite descargas automáticas de esa página (robots.txt). Copia y pega el texto o sube el archivo.");
  const wait = (lastHit.get(url.origin) ?? 0) + Math.max(MIN_INTERVAL_MS, rules.crawlDelayMs) - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 10_000))); // Espera acotada: la petición del docente no se cuelga
  lastHit.set(url.origin, Date.now());
  return safeFetch(url.toString());
}
