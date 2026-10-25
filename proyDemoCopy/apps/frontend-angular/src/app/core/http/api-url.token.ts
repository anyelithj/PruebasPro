import { InjectionToken } from '@angular/core';
// [API_URL · core/http]: base de /api/* del BFF de Next.js (Angular no tiene BFF propio) | [Patrón]: Dependency Injection Token | [Principio]: DIP + SSOT (los repositorios piden la base, no la escriben)

// `InjectionToken<string>` (Angular): token tipado; `factory` + `providedIn: 'root'` → valor por defecto sin registrarlo en ningún provider
// Mismo origen que Next.js (rewrites /ng/*) → ruta relativa; en pruebas se sustituye por una URL absoluta para msw
export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
