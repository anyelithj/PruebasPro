import { RequestMethod, type INestApplication } from '@nestjs/common';
// `@nestjs/common/constants`: claves de metadatos que escriben @Get/@Post, @HttpCode, @Sse y los decoradores de parámetros (@Body, @Query, @Param)
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  ROUTE_ARGS_METADATA,
  SSE_METADATA,
} from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { ModulesContainer } from '@nestjs/core'; // `ModulesContainer` (NestJS): registro de módulos → controladores ya escaneados (también con `preview: true`)
import {
  ApiResponse,
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger'; // `ApiResponse`: 204 sin cuerpo (Nest no envía envelope)
// [API_RESPONSE_METADATA]: clave donde @ApiResponse guarda sus códigos (= DECORATORS.API_RESPONSE de @nestjs/swagger, no exportado en su `exports`) → respetar lo que un controlador ya declaró
const API_RESPONSE_METADATA = 'swagger/apiResponse';
import {
  ApiEnvelope,
  ApiErrorResponse,
} from '../decorators/api-response.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
// [Swagger / OpenAPI 3 · Sprint 11.2 · RF-73]: fuente ÚNICA de la documentación de la API (main.ts, scripts/export-openapi.ts y la prueba de contrato) | [Patrón]: Builder (DocumentBuilder) + Facade (SwaggerModule) | [Principio]: DRY + SSOT (antes main.ts y export-openapi.ts repetían el DocumentBuilder) | [Paradigma]: Funcional (funciones puras sobre la app)
// `import type` (TypeScript): importa solo tipos → se borran al compilar

// [Ruta de la UI]: `${prefijo}/docs` (Swagger UI) y `${prefijo}/docs-json` (especificación OpenAPI que consume `pnpm api:types` en Next.js)
export const SWAGGER_PATH = 'docs'; // `export const` (ESM): constante pública e inmutable

// [buildOpenApiDocument]: genera el documento OpenAPI 3 a partir de los decoradores @ApiTags/@ApiOperation de los controladores | [Patrón]: Builder
// `INestApplication` (NestJS): la app ya creada (con prefijo global) | `OpenAPIObject` (@nestjs/swagger): tipo del documento devuelto (Type-Safe)
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder() // `new` (JS): instancia el constructor fluido
    .setTitle('Aula de Idiomas — API') // Título visible en la UI y en el cliente generado
    .setDescription(
      'Backend NestJS 11 · REST + OpenAPI 3 · JWT + RBAC · Cursos, exámenes, IA, pagos y Web3',
    )
    .setVersion('1.0')
    .addBearerAuth() // [Seguridad]: esquema `bearer` (JWT) → botón «Authorize» en la UI
    .build(); // `build()`: congela la configuración (fin del Builder)
  documentStandardResponses(app); // Antes de createDocument: el explorador de Swagger lee los metadatos que añade
  return SwaggerModule.createDocument(app, config); // Recorre los controladores registrados y emite paths + schemas
}

// [documentStandardResponses · Swagger Nest]: respuesta 2xx (envelope) + errores posibles en TODAS las operaciones, deducidos de los metadatos que Nest ya tiene → ningún controlador repite @ApiResponse
// [Reglas]: 400 = recibe @Body/@Query/@Param (ValidationPipe) · 401 = sin @Public (JwtAuthGuard) · 403 = con @Roles (RolesGuard) · 404 = recibe @Param · 408/429/500 = TimeoutInterceptor, ThrottlerGuard y fallo inesperado
// [Patrón]: Decorator aplicado en tiempo de arranque + Visitor (recorre controladores y métodos) | [Principio]: DRY + OCP (endpoint nuevo = documentado sin tocarlo) + SSOT (los guards y la doc leen los MISMOS metadatos) | [Paradigma]: AOP + Reflexión (reflect-metadata)
// [Prioridad]: si un método ya declara un código (p. ej. `@ApiEnvelope(200, CourseDto)`), ese gana; aquí solo se rellenan los que faltan
const ERROR_RULES: ReadonlyArray<
  readonly [number, string, (r: RouteFacts) => boolean]
> = [
  [400, 'Datos de entrada no válidos (ValidationPipe)', (r) => r.hasInput],
  [401, 'Falta el token JWT o ha caducado', (r) => !r.isPublic],
  [403, 'El rol del usuario no tiene permiso', (r) => r.hasRoles],
  [404, 'El recurso no existe', (r) => r.hasParam],
  [408, 'La operación superó el tiempo máximo', () => true],
  [429, 'Demasiadas peticiones (límite de frecuencia)', () => true],
  [500, 'Error inesperado del servidor', () => true],
];

// `interface` (TS): datos de una ruta que deciden qué errores documentar
interface RouteFacts {
  isPublic: boolean;
  hasRoles: boolean;
  hasInput: boolean;
  hasParam: boolean;
}

const documented = new WeakSet<object>(); // `WeakSet` (ES2015): cada método se enriquece una sola vez aunque se genere el documento varias veces (tests)

function documentStandardResponses(app: INestApplication): void {
  // `flatMap` (ES2019): módulos → controladores (`metatype` = la clase) | `filter(Boolean)`: descarta envoltorios sin clase
  const controllers = [...app.get(ModulesContainer).values()].flatMap((m) =>
    [...m.controllers.values()].map(
      (w) => w.metatype as (new () => object) | null,
    ),
  );
  for (const ctrl of controllers.filter((c): c is new () => object =>
    Boolean(c),
  )) {
    const proto = ctrl.prototype as Record<string, unknown>;
    for (const key of Object.getOwnPropertyNames(proto)) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      const handler = descriptor?.value as object | undefined;
      // Guard clauses: solo métodos de ruta (@Get, @Post, @Sse…) y no procesados antes
      if (
        !descriptor ||
        typeof handler !== 'function' ||
        documented.has(handler)
      )
        continue;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as
        | RequestMethod
        | undefined;
      if (method === undefined) continue;
      documented.add(handler);

      // `Reflect.getMetadata` (reflect-metadata): método primero, luego clase = mismo orden que `reflector.getAllAndOverride` de los guards
      const meta = <T>(k: string): T | undefined =>
        (Reflect.getMetadata(k, handler) ?? Reflect.getMetadata(k, ctrl)) as
          | T
          | undefined;
      // ROUTE_ARGS_METADATA: { "3:0": …, "5:1": … } → `${RouteParamtypes}:${índice}` | `parseInt` ignora el sufijo de los decoradores propios
      const argTypes = Object.keys(
        (Reflect.getMetadata(ROUTE_ARGS_METADATA, ctrl, key) ?? {}) as object,
      ).map((k) => parseInt(k, 10));
      const has = (t: RouteParamtypes) => argTypes.includes(t);
      const facts: RouteFacts = {
        isPublic: meta<boolean>(IS_PUBLIC_KEY) === true,
        hasRoles: (meta<unknown[]>(ROLES_KEY)?.length ?? 0) > 0,
        hasInput:
          has(RouteParamtypes.BODY) ||
          has(RouteParamtypes.QUERY) ||
          has(RouteParamtypes.PARAM),
        hasParam: has(RouteParamtypes.PARAM),
      };

      const declared = Object.keys(
        (Reflect.getMetadata(API_RESPONSE_METADATA, handler) ?? {}) as object,
      ); // Códigos ya escritos a mano
      // [Éxito]: @HttpCode o el valor por defecto de Nest (201 en POST, 200 en el resto) | 204 = sin cuerpo
      const success =
        (Reflect.getMetadata(HTTP_CODE_METADATA, handler) as
          | number
          | undefined) ?? (method === RequestMethod.POST ? 201 : 200);
      // [Éxito por tipo de ruta]: SSE = flujo `text/event-stream` sin envelope (TransformInterceptor lo salta) · 204 = sin cuerpo · resto = envelope
      const successDoc = Reflect.getMetadata(SSE_METADATA, handler)
        ? ApiResponse({
            status: 200,
            description: 'Flujo de eventos (Server-Sent Events)',
            content: { 'text/event-stream': { schema: { type: 'string' } } },
          })
        : success === 204
          ? ApiResponse({
              status: 204,
              description: 'Operación correcta, sin contenido',
            })
          : ApiEnvelope(success);
      const decorators = [
        ...(declared.some((s) => s.startsWith('2')) ? [] : [successDoc]),
        ...ERROR_RULES.filter(
          ([status, , applies]) =>
            applies(facts) && !declared.includes(String(status)),
        ).map(([status, text]) => ApiErrorResponse(status, text)),
      ];
      // Aplicar un decorador de método a mano = lo mismo que hace TypeScript con `@Decorador` sobre el método
      for (const decorate of decorators) decorate(proto, key, descriptor);
    }
  }
}

// [setupSwagger]: monta Swagger UI solo fuera de producción | [Principio]: Seguridad por defecto (no expone el esquema en prod) + SRP (main.ts solo orquesta)
// `string` (TS): prefijo global (p. ej. 'api/v1') | `void` (TS): no devuelve nada
export function setupSwagger(app: INestApplication, apiPrefix: string): void {
  if (process.env.NODE_ENV === 'production') return; // Guard Clause: corta temprano en prod
  SwaggerModule.setup(
    `${apiPrefix}/${SWAGGER_PATH}`,
    app,
    buildOpenApiDocument(app),
    {
      swaggerOptions: { persistAuthorization: true }, // Conserva el token JWT al recargar la UI (DX)
    },
  );
}
