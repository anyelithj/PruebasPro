import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from '../../src/app.module';
import { buildOpenApiDocument } from '../../src/shared/config/swagger.config';
// [Suite Usability · contrato Swagger · Sprint 11.2 · RF-73]: valida el OpenAPI REAL de los 27 módulos (no un controlador de ejemplo) → todos los endpoints documentados | [Patrón]: Contract Testing | [Principio]: SSOT (mismo buildOpenApiDocument que main.ts y export-openapi.ts) | [Paradigma]: Declarativo (Jest)
// [Por qué]: el OpenAPI genera @aula/api-client (pnpm api:types); un endpoint sin documentar rompe el contrato cliente/servidor sin avisar

// [jest.mock · jose]: paquete solo-ESM que Jest (CommonJS) no puede cargar; con `preview: true` los verificadores OAuth nunca se ejecutan → stub vacío | [Patrón]: Stub
// `jest.mock` (Jest): se eleva (hoisting) por encima de los imports → AppModule recibe el stub
jest.mock('jose', () => ({}));

// [HTTP_METHODS]: claves de un PathItem que son operaciones (OpenAPI 3) | `as const` (TS): tupla de literales
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

describe('Usability: contrato Swagger (OpenAPI de la API real)', () => {
  let doc: OpenAPIObject; // `let` (JS): se asigna en beforeAll
  let app: INestApplication;

  // `beforeAll` (Jest): una sola vez → crear la app es costoso
  beforeAll(async () => {
    // `preview: true` (NestJS): arma el grafo de módulos y controladores SIN instanciar proveedores → sin PostgreSQL ni Redis | [Patrón]: Test Double implícito
    app = await NestFactory.create(AppModule, { preview: true, logger: false });
    app.setGlobalPrefix('api/v1'); // Mismo prefijo que main.ts
    doc = buildOpenApiDocument(app);
  }, 60_000); // Timeout amplio: carga los 27 módulos

  afterAll(() => app.close()); // `afterAll` (Jest): libera recursos

  // [operations]: aplana paths × métodos → lista de operaciones | [Paradigma]: Funcional (flatMap/filter sin mutación)
  const operations = () =>
    Object.entries(doc.paths).flatMap(([path, item]) =>
      HTTP_METHODS.filter((m) => item[m]).map((m) => ({
        id: `${m.toUpperCase()} ${path}`,
        op: item[m]!,
      })),
    );

  it('info: título, versión y esquema bearer (JWT)', () => {
    expect(doc.info.title).toBe('Aula de Idiomas — API');
    expect(doc.info.version).toBe('1.0');
    expect(doc.components?.securitySchemes?.['bearer']).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });

  it('expone las rutas bajo el prefijo /api/v1', () => {
    const paths = Object.keys(doc.paths);
    expect(paths.length).toBeGreaterThan(100); // 27 módulos → cientos de rutas; un número bajo = módulos sin registrar
    expect(paths.every((p) => p.startsWith('/api/v1'))).toBe(true);
  });

  it('toda operación tiene tag (agrupación en la UI) y summary (descripción)', () => {
    // [Mensaje útil]: lista exacta de operaciones incumplidas en vez de un booleano
    const missing = operations()
      .filter(({ op }) => !op.tags?.length || !op.summary)
      .map(({ id }) => id);
    expect(missing).toEqual([]);
  });

  // [documentStandardResponses]: toda operación declara su respuesta 2xx y al menos el error 500 con el esquema común ApiErrorDto
  it('toda operación documenta su respuesta de éxito y sus errores', () => {
    const missing = operations()
      .filter(({ op }) => {
        const codes = Object.keys(op.responses ?? {}); // `Object.keys` (ES5): códigos HTTP documentados
        return !codes.some((c) => c.startsWith('2')) || !codes.includes('500');
      })
      .map(({ id }) => id);
    expect(missing).toEqual([]);
    expect(doc.components?.schemas?.['ApiErrorDto']).toBeDefined(); // Un solo esquema de error referenciado por $ref
  });

  // [Reglas]: errores deducidos de @Public, @Roles y @Param (los mismos metadatos que leen JwtAuthGuard y RolesGuard)
  it('errores según la ruta: pública sin 401, protegida con @Roles y :id con 401/403/404', () => {
    const login = doc.paths['/api/v1/auth/login']?.post; // @Public → sin token
    expect(Object.keys(login?.responses ?? {})).not.toContain('401');
    const updateUser = doc.paths['/api/v1/users/{id}']?.patch; // JWT + @Roles + @Param
    expect(Object.keys(updateUser?.responses ?? {})).toEqual(
      expect.arrayContaining(['200', '400', '401', '403', '404']),
    );
  });

  it('operationId único por operación (base de los nombres del cliente generado)', () => {
    const ids = operations().map(({ op }) => op.operationId);
    expect(new Set(ids).size).toBe(ids.length); // `Set` (JS): elimina duplicados → mismo tamaño = únicos
  });
});
