import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
// [Decorator composable]: documenta el envelope estándar { data, meta, statusCode } | [Patrón]: Composite + Decorator | [Principio]: DRY | [Paradigma]: AOP

// [Wrapper Swagger genérico]: aplica esquema envelope a cualquier DTO | [Principio]: OCP
export const ApiOkEnvelope = <TModel extends Type<unknown>>(model: TModel) =>
  applyDecorators(
    // [Registro modelo Swagger]: necesario para $ref dinámico
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        properties: {
          statusCode: { type: 'number', example: 200 },
          data: { $ref: getSchemaPath(model) },
          meta: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', format: 'date-time' },
              path: { type: 'string' },
            },
          },
        },
      },
    }),
  );

// [Error standard]: documenta forma uniforme de errores | [Principio]: SSOT
export const ApiErrorResponse = (status: number, description: string) =>
  ApiResponse({
    status,
    description,
    schema: {
      properties: {
        statusCode: { type: 'number', example: status },
        message: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        path: { type: 'string' },
      },
    },
  });
