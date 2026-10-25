import { setupZonelessTestEnv } from 'jest-preset-angular/setup-env/zoneless';
import { FakeEventSource } from './__tests__/utils/fake-event-source';
import { server } from './__tests__/utils/msw/server';
// [jest.setup.ts]: mismo nombre que en Next.js (apps/frontend-next/jest.setup.ts) | [Setup Jest]: inicializa el entorno de pruebas de Angular SIN zone.js (igual que la app), el servidor msw y un EventSource falso | [Patrón]: Test Fixture global | [Principio]: DRY (cada spec no repite el arranque)

setupZonelessTestEnv();

// [EventSource]: jsdom no lo trae → doble controlable desde las specs (FakeEventSource.last(url).emit(...))
(globalThis as unknown as { EventSource: typeof FakeEventSource }).EventSource = FakeEventSource;

// [msw]: `onUnhandledRequest: 'error'` → una petición no simulada falla la prueba (no hay red real en los tests)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers(); // Cada prueba empieza con los handlers por defecto
  FakeEventSource.instances = [];
});
afterAll(() => server.close());
