// [Port WebPageFetcher · 2026-10-24]: descarga una página pública para leer la letra de una canción sin que el caso de uso conozca node:http, DNS ni compresión | [Patrón]: Port (Hexagonal) | [Principio]: DIP + ISP (un método) | [Paradigma]: POO

// `Symbol` (ES2015): token de inyección único (no choca con otros proveedores)
export const WEB_PAGE_FETCHER = Symbol('WEB_PAGE_FETCHER');

// [WebPage]: respuesta ya descomprimida (los bytes se decodifican según su charset en el caso de uso)
export interface WebPage {
  url: string; // URL final tras las redirecciones
  contentType: string; // Cabecera Content-Type completa (con `charset=` si el sitio lo declara)
  body: Buffer;
}

// [Motivos de fallo]: el caso de uso los traduce a mensajes accionables | `as const`: unión de literales desde el arreglo
export const WEB_FETCH_FAILURES = [
  'invalid_url', // No es http/https o trae credenciales/puerto raro
  'private_address', // Apunta a la red interna (anti-SSRF)
  'blocked', // 401/403/429 tras probar con perfiles de navegador
  'challenge', // Protección anti-bots que exige JavaScript (Cloudflare «Just a moment…»)
  'not_found', // 404/410
  'http_status', // Cualquier otro código no 2xx
  'too_large',
  'timeout',
  'network', // DNS, TLS, conexión rechazada…
] as const;
export type WebFetchFailure = (typeof WEB_FETCH_FAILURES)[number];

// [WebFetchError]: error tipado del adaptador | `extends Error` (ES2015) + `readonly` (TS) en el constructor = propiedades inmutables
export class WebFetchError extends Error {
  constructor(
    readonly reason: WebFetchFailure,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'WebFetchError';
  }
}

export interface WebPageFetcher {
  fetch(url: string): Promise<WebPage>;
}
