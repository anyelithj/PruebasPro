import { http, HttpResponse } from 'msw';
// [Handlers msw]: respuestas por defecto de /api/* (BFF de Next.js) para las pruebas — con el envelope de NestJS donde lo hay | [Patrón]: Test Double (Fake server) | [Principio]: DRY (las specs solo sobrescriben lo que cambian)
// [Tecnología]: msw 2 (`http.get/post`, `HttpResponse.json`)

export const API = 'http://localhost/api'; // Base absoluta: fetch de Node no admite rutas relativas

// [envelope]: forma del TransformInterceptor de NestJS → prueba también el envelopeInterceptor
export const envelope = <T>(data: T) => ({ statusCode: 200, data, meta: { timestamp: new Date(0).toISOString(), path: '' } });

export const handlers = [
  http.get(`${API}/auth/me`, () => HttpResponse.json({ user: { id: 'u1', email: 'ana@aula.test', role: 'ADMIN', firstName: 'Ana' } })),
  http.get(`${API}/notifications/me`, () =>
    HttpResponse.json(
      envelope({
        items: [{ id: 'n1', title: 'Hola', body: 'Bienvenida', isRead: false, createdAt: '2026-10-15T10:00:00Z', payload: { href: '/tutor' } }],
        unread: 1,
      }),
    ),
  ),
  http.patch(`${API}/notifications/:id/read`, () => HttpResponse.json(envelope({ updated: 1 }))),
  http.patch(`${API}/notifications/me/read`, () => HttpResponse.json(envelope({ updated: 1 }))),
  http.get(`${API}/reports/export/me`, () => HttpResponse.json(envelope([]))),
  // [Sprint 10.3]: palabras marcadas del diccionario (cualquier texto con <aula-word-lookup> las pide para resaltarlas)
  http.get(`${API}/vocabulary/words`, () => HttpResponse.json(envelope([]))),
];
