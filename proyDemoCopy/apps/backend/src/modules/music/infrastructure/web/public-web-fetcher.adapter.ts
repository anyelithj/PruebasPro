import dns from 'node:dns';
import http, { type IncomingMessage } from 'node:http';
import https from 'node:https';
import net from 'node:net';
import zlib from 'node:zlib';
import { Injectable } from '@nestjs/common';
import {
  type WebPage,
  WebFetchError,
  type WebPageFetcher,
} from '../../domain/interfaces/web-page-fetcher.interface';
// [Adapter PublicWebFetcher · 2026-10-24]: GET de una página pública «como un navegador» para importar la letra de una canción
// [Bug]: «El sitio bloqueó la descarga automática (código 403)» — el importador se identificaba como bot (UA con sufijo propio, sin Accept-Encoding ni Sec-Fetch-*) y muchos CDN/WAF lo rechazaban
// Ahora: cabeceras completas de Chrome (y un segundo intento como Firefox con Referer), cookies entre redirecciones, gzip/br/deflate y diagnóstico del bloqueo real (anti-bots con JavaScript)
// [Seguridad · anti-SSRF]: solo http/https en 80/443, sin credenciales en la URL, la IP se valida EN la conexión (lookup propio → sin DNS rebinding) y en cada redirección; tiempo y tamaño máximos
// [Patrón]: Adapter (implementa WebPageFetcher) + Retry con estrategia alternativa (perfiles de navegador) + Guard | [Principio]: SRP + Secure by default | [Tecnología]: node:http/https + node:dns + node:zlib (sin dependencias nuevas)

const MAX_BYTES = 5 * 1024 * 1024; // Una página de letras pesa < 1 MB; tope comprimido y descomprimido
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;
const BLOCK_STATUSES = new Set([401, 403, 429, 503]); // Respuestas típicas de un WAF ante un cliente «raro»

// [Perfiles de navegador]: el primero imita Chrome estable; el segundo Firefox con Referer (algunos WAF solo bloquean la huella de Chrome sin JS) | `Object.freeze`: inmutables
export const BROWSER_PROFILES: ReadonlyArray<Readonly<Record<string, string>>> = Object.freeze([
  Object.freeze({
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Ch-Ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
  }),
  Object.freeze({
    'User-Agent':
      'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
    'Accept-Encoding': 'gzip, deflate, br',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-User': '?1',
  }),
]);

// [Rangos no públicos]: `net.BlockList` (Node.js) — loopback, redes privadas, link-local (metadatos cloud 169.254.169.254), CGNAT, multicast y reservados
const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const)
  blocked.addSubnet(addr, prefix, 'ipv4');
for (const [addr, prefix] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96]] as const)
  blocked.addSubnet(addr, prefix, 'ipv6');

// [isPrivateAddress]: también IPv4 «mapeadas» en IPv6 (::ffff:10.0.0.1) | Función pura (exportada para las pruebas)
export function isPrivateAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return blocked.check(mapped[1]!, 'ipv4');
  return blocked.check(address, net.isIPv6(address) ? 'ipv6' : 'ipv4');
}

// [guardedLookup]: resolución DNS que rechaza IPs no públicas ANTES de conectar | firma compatible con `lookup` de http.request
const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err, '', 4);
    if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address)))
      return callback(new Error('PRIVATE_ADDRESS'), '', 4);
    if ((options as { all?: boolean }).all)
      return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, addresses);
    callback(null, addresses[0]!.address, addresses[0]!.family);
  });
};

// [assertPublicUrl]: valida protocolo, puerto, credenciales e IP literal | lanza WebFetchError | Función pura (exportada para las pruebas)
export function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new WebFetchError('invalid_url', 'El enlace no es una URL válida.');
  }
  if (!['http:', 'https:'].includes(url.protocol))
    throw new WebFetchError('invalid_url', 'Solo se admiten enlaces http o https.');
  if (url.port && !['80', '443'].includes(url.port))
    throw new WebFetchError('invalid_url', 'Solo se admiten los puertos estándar (80/443).');
  if (url.username || url.password)
    throw new WebFetchError('invalid_url', 'El enlace no puede incluir usuario o contraseña.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || (net.isIP(host) && isPrivateAddress(host)))
    throw new WebFetchError('private_address', 'Ese enlace apunta a una red privada y no está permitido.');
  return url;
}

// [looksLikeChallenge]: página de verificación anti-bots que exige JavaScript (no se puede pasar desde el servidor) | Función pura
export function looksLikeChallenge(headers: Record<string, string | string[] | undefined>, body: string): boolean {
  return (
    headers['cf-mitigated'] === 'challenge' ||
    /cf-chl|challenge-platform|Just a moment\.\.\.|Attention Required!|captcha-delivery|px-captcha|_Incapsula_Resource/i.test(body.slice(0, 20_000))
  );
}

// [decompress]: gzip / deflate / br según Content-Encoding, con tope de salida (`maxOutputLength`: evita «zip bombs») | Función pura
export function decompress(body: Buffer, encoding: string | undefined): Buffer {
  const opts = { maxOutputLength: MAX_BYTES };
  switch ((encoding ?? '').trim().toLowerCase()) {
    case 'gzip':
    case 'x-gzip':
      return zlib.gunzipSync(body, opts);
    case 'deflate':
      // Algunos servidores mandan deflate «crudo» (sin cabecera zlib) → se prueba el otro formato
      try {
        return zlib.inflateSync(body, opts);
      } catch {
        return zlib.inflateRawSync(body, opts);
      }
    case 'br':
      return zlib.brotliDecompressSync(body, opts);
    default:
      return body; // identity o sin cabecera
  }
}

interface RawResponse {
  status: number;
  headers: IncomingMessage['headers'];
  body: Buffer;
}

@Injectable()
export class PublicWebFetcher implements WebPageFetcher {
  // [fetch]: recorre los perfiles de navegador; solo si TODOS reciben un bloqueo se informa el motivo real
  async fetch(raw: string): Promise<WebPage> {
    let last: WebFetchError | null = null;
    for (const [i, profile] of BROWSER_PROFILES.entries()) {
      try {
        return await this.follow(assertPublicUrl(raw), { ...profile, ...(i > 0 ? { Referer: `${new URL(raw).origin}/` } : {}) });
      } catch (err) {
        if (!(err instanceof WebFetchError) || err.reason !== 'blocked') throw err; // Otros fallos (404, anti-bots con JS, red) no mejoran cambiando de navegador
        last = err;
      }
    }
    throw last ?? new WebFetchError('blocked', 'El sitio bloqueó la descarga automática.');
  }

  // [follow]: GET + redirecciones revalidadas (cada salto vuelve a pasar el guard) + cookies del sitio entre saltos | [Patrón]: Iterator (bucle de saltos)
  private async follow(start: URL, headers: Record<string, string>): Promise<WebPage> {
    const cookies = new Map<string, string>(); // `Map` (ES2015): nombre → valor (tarro mínimo por petición, nunca se persiste)
    let url = start;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
      const res = await this.request(url, cookie ? { ...headers, Cookie: cookie } : headers);
      for (const c of [res.headers['set-cookie'] ?? []].flat()) {
        const [pair] = c.split(';');
        const eq = pair?.indexOf('=') ?? -1;
        if (pair && eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
      if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.location) {
        url = assertPublicUrl(new URL(res.headers.location, url).toString()); // Revalida protocolo, puerto e IP literal del destino
        continue;
      }
      const body = decompress(res.body, res.headers['content-encoding']);
      if (res.status >= 200 && res.status < 300)
        return { url: url.toString(), contentType: String(res.headers['content-type'] ?? ''), body };
      throw this.statusError(res.status, res.headers, body);
    }
    throw new WebFetchError('http_status', 'La página redirige demasiadas veces.');
  }

  // [statusError]: código HTTP → motivo tipado (anti-bots con JS ≠ bloqueo simple ≠ no existe) | [Patrón]: Error Translation
  private statusError(status: number, headers: IncomingMessage['headers'], body: Buffer): WebFetchError {
    if (looksLikeChallenge(headers, body.toString('latin1')))
      return new WebFetchError('challenge', 'El sitio exige una verificación anti-bots en el navegador.', status);
    if (BLOCK_STATUSES.has(status))
      return new WebFetchError('blocked', `El sitio bloqueó la descarga automática (código ${status}).`, status);
    if (status === 404 || status === 410)
      return new WebFetchError('not_found', `La página no existe (código ${status}).`, status);
    return new WebFetchError('http_status', `La página respondió con el código ${status}.`, status);
  }

  // [request]: un GET con lookup protegido, tiempo y tamaño máximos | `new Promise` (ES2015) sobre la API de callbacks de Node
  private request(url: URL, headers: Record<string, string>): Promise<RawResponse> {
    return new Promise((resolve, reject) => {
      const lib = url.protocol === 'https:' ? https : http;
      const req = lib.get(url, { lookup: guardedLookup, timeout: TIMEOUT_MS, headers }, (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            req.destroy();
            reject(new WebFetchError('too_large', 'La página supera 5 MB.'));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
        res.on('error', (e) => reject(new WebFetchError('network', e.message)));
      });
      req.on('timeout', () => req.destroy(new WebFetchError('timeout', 'La página tardó demasiado en responder.')));
      req.on('error', (err) =>
        reject(
          err instanceof WebFetchError
            ? err
            : err.message === 'PRIVATE_ADDRESS'
              ? new WebFetchError('private_address', 'Ese enlace apunta a una red privada y no está permitido.')
              : new WebFetchError('network', `No se pudo conectar con el sitio (${err.message}).`),
        ),
      );
    });
  }
}
