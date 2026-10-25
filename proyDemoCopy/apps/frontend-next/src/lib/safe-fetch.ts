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
