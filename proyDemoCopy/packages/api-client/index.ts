import type { paths } from "./generated";
// [@aula/api-client · Sprint 7.1 · RF-86]: contrato TypeScript de la API de NestJS generado desde su OpenAPI (generated.ts, openapi-typescript) + tipos derivados | [Patrón]: Contract-First (tipos generados, nunca escritos a mano) | [Principio]: SSOT (el backend define la API) + Fail Fast (una ruta que ya no existe rompe la compilación del frontend) | [Paradigma]: Programación a nivel de tipos
// [Regenerar]: `pnpm api:types` en apps/frontend-next con el backend en marcha (lee /api/v1/docs-json) · solo tipos → 0 bytes en el bundle

export type { paths };

// [ApiRoute]: rutas sin el prefijo global («forums/threads/{id}») | template literal types (TS 4.1)
type Strip<P> = P extends `/api/v1/${infer R}` ? R : never;
export type ApiRoute = Strip<keyof paths>;

// [Prefixes]: todos los prefijos por segmento de una ruta → «reports», «reports/export», «reports/export/me» | tipo recursivo
type Prefixes<S extends string> = S extends `${infer Head}/${infer Tail}` ? Head | `${Head}/${Prefixes<Tail>}` : S;

// [ApiPrefix]: prefijo válido de alguna ruta real del backend → lo usa la lista blanca del BFF (apps/frontend-next/src/lib/bff/forward.ts)
export type ApiPrefix = Prefixes<ApiRoute>;
