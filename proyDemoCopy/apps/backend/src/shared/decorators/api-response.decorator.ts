import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
// [Decoradores de respuesta Swagger]: documentan el envelope de éxito (TransformInterceptor) y el de error (HttpExceptionFilter) | [Patrón]: Decorator + Composite (applyDecorators) | [Principio]: DRY + SSOT (una sola definición de cada forma) | [Paradigma]: AOP + Declarativo
// [Uso]: swagger.config.ts los aplica a TODAS las operaciones (documentStandardResponses); un controlador solo los escribe para afinar `data` con su DTO → `@ApiEnvelope(200, CourseDto)`

// [EnvelopeMetaDto]: `meta` del envelope de éxito | `class` (TS/JS): Swagger necesita una clase (no una interface, que se borra al compilar) para emitir el esquema
// `!` (TS · definite assignment): la propiedad la rellena el interceptor, no un constructor
export class EnvelopeMetaDto {
  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-04T10:00:00.000Z',
  }) // `@ApiProperty` (@nestjs/swagger): propiedad del esquema OpenAPI
  timestamp!: string;

  @ApiProperty({ type: String, example: '/api/v1/courses' })
  path!: string;
}

// [ApiErrorDto]: cuerpo de error de HttpExceptionFilter { statusCode, message, code?, timestamp, path, method } | [Principio]: SSOT (misma forma en las 342 operaciones vía $ref)
export class ApiErrorDto {
  @ApiProperty({ type: Number, example: 400 })
  statusCode!: number;

  // `oneOf` (OpenAPI 3): ValidationPipe devuelve una lista de mensajes; el resto de excepciones, un texto
  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'title must be a string',
  })
  message!: string | string[];

  // `@ApiPropertyOptional` (@nestjs/swagger): opcional en el esquema | código estable para que el frontend decida sin parsear el texto
  @ApiPropertyOptional({ type: String, example: 'SPEECH_ENGINE_MISSING' })
  code?: string;

  @ApiProperty({ type: String, format: 'date-time' })
  timestamp!: string;

  @ApiProperty({ type: String, example: '/api/v1/courses' })
  path!: string;

  @ApiProperty({ type: String, example: 'POST' })
  method!: string;
}

// [ApiEnvelope]: respuesta 2xx envuelta en { statusCode, data, meta } | `model` opcional → `data` con $ref al DTO; sin él, `data` libre (objeto, lista o valor) | [Principio]: OCP
// `<TModel extends Type<unknown>>` (TS · genérico con restricción): solo acepta clases
export const ApiEnvelope = <TModel extends Type<unknown>>(
  status: number,
  model?: TModel,
  description = 'Operación correcta',
) =>
  // `applyDecorators` (NestJS): compone varios decoradores en uno | [Patrón]: Composite
  applyDecorators(
    // `ApiExtraModels` (Swagger): registra los esquemas usados por $ref dinámico | spread condicional (ES2018): el DTO solo si existe
    ApiExtraModels(EnvelopeMetaDto, ...(model ? [model] : [])),
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        required: ['statusCode', 'data', 'meta'],
        properties: {
          statusCode: { type: 'number', example: status },
          // `getSchemaPath` (Swagger): '#/components/schemas/<Nombre>' | `{}` (JSON Schema): cualquier valor
          data: model
            ? { $ref: getSchemaPath(model) }
            : {
                description: 'Carga útil del endpoint (objeto, lista o valor)',
              },
          meta: { $ref: getSchemaPath(EnvelopeMetaDto) },
        },
      },
    }),
  );

// [ApiErrorResponse]: error con la forma uniforme del filtro global | `type` → $ref a ApiErrorDto (un esquema, no 342 copias)
export const ApiErrorResponse = (status: number, description: string) =>
  ApiResponse({ status, description, type: ApiErrorDto });
