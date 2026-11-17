import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
// [Filter global de errores]: formato uniforme { statusCode, message, timestamp, path } | [Patrón]: Exception Filter (Chain of Responsibility) | [Principio]: SSOT | [Paradigma]: AOP

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  // [Logger Nest]: namespace propio para grep en logs | [Patrón]: Singleton
  private readonly logger = new Logger(HttpExceptionFilter.name);

  // [catch]: contrato del filter, recibe cualquier excepción | [Principio]: SRP
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // [Errores conocidos fuera de Nest · 2026-10-27]: PostgreSQL (QueryFailedError) y body-parser (413/400) se traducen a 4xx con un mensaje útil
    // [Bug que corrige]: «No se pudo guardar el recurso: Elemento 1: Internal server error · …» → la UI no decía QUÉ fallaba (texto demasiado largo,
    // carácter nulo de un PDF, clave repetida, migración sin aplicar…) | [Patrón]: Translator (error técnico → HttpException) | [Principio]: OCP (las HttpException no cambian)
    const known =
      exception instanceof HttpException
        ? null
        : translateKnownError(exception);
    const handled = known ?? exception;

    // [Status resolution]: HttpException expone status, otros = 500
    const status =
      handled instanceof HttpException
        ? handled.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // [Mensaje normalizado]: HttpException.getResponse puede ser string u objeto
    const exceptionResponse =
      handled instanceof HttpException
        ? handled.getResponse()
        : 'Internal server error';

    const body =
      typeof exceptionResponse === 'string'
        ? undefined
        : (exceptionResponse as {
            message?: string | string[];
            code?: unknown;
          });
    const message = body
      ? (body.message ?? 'Unexpected error')
      : exceptionResponse;
    // [code · 2026-10-25]: código estable opcional (p. ej. SPEECH_ENGINE_MISSING) → el frontend decide el respaldo sin parsear el texto | [Principio]: OCP (las excepciones sin `code` no cambian)
    const code = typeof body?.code === 'string' ? body.code : undefined;

    // [Envelope error]: forma estable para consumidores frontend
    const errorBody = {
      statusCode: status,
      message,
      ...(code && { code }), // Spread condicional: la clave solo aparece si hay código
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    // [Log diferenciado]: 5xx error, 4xx warn (no contamina alertas)
    // [2026-10-25]: un 503 lanzado a propósito (ServiceUnavailableException: dependencia caída o no instalada) es esperable → sin stack;
    // si además trae `code`, el adaptador que lo lanzó ya avisó (WARN una vez) → aquí solo DEBUG para no repetirlo en cada petición
    // [2026-10-28]: 504 GATEWAY_TIMEOUT (IA/Ollama superó su límite de tiempo) también es esperable → sin stack | `includes` (ES2016)
    const expectedUnavailable =
      handled instanceof HttpException &&
      [HttpStatus.SERVICE_UNAVAILABLE, HttpStatus.GATEWAY_TIMEOUT].includes(
        status,
      );

    if (status >= 500 && !expectedUnavailable) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (expectedUnavailable && code) {
      this.logger.debug(`${request.method} ${request.url} → ${status} ${code}`);
    } else {
      // [2026-10-27]: error de PostgreSQL traducido a 4xx → se añade el mensaje original (campo, restricción) para diagnosticar sin stack
      const original =
        known && exception instanceof Error ? ` · ${exception.message}` : '';
      this.logger.warn(
        `${request.method} ${request.url} → ${status}: ${JSON.stringify(message)}${original}`,
      );
    }

    response.status(status).json(errorBody);
  }
}

// [PG_ERRORS · 2026-10-27]: códigos SQLSTATE de PostgreSQL → status + mensaje en español | `Readonly<Record<…>>` (TS) | [Patrón]: Lookup Table
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_ERRORS: Readonly<
  Record<string, { status: HttpStatus; message: string }>
> = Object.freeze({
  '23505': {
    status: HttpStatus.CONFLICT,
    message: 'Ya existe un registro con esos datos (clave repetida).',
  },
  '23503': {
    status: HttpStatus.BAD_REQUEST,
    message:
      'Hace referencia a un registro que no existe (tema, fuente o usuario).',
  },
  '23502': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Falta un dato obligatorio.',
  },
  '23514': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Un dato no cumple las reglas de la base de datos.',
  },
  '22001': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Un texto supera la longitud máxima permitida.',
  },
  '22P02': {
    status: HttpStatus.BAD_REQUEST,
    message:
      'Un dato tiene un formato no válido (identificador, número o valor de lista).',
  },
  '22P05': {
    status: HttpStatus.BAD_REQUEST,
    message:
      'El contenido trae caracteres no admitidos (p. ej. un carácter nulo copiado de un PDF).',
  },
  '22021': {
    status: HttpStatus.BAD_REQUEST,
    message:
      'El contenido trae caracteres no admitidos (codificación no válida).',
  },
  '42703': {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message:
      'La base de datos no está actualizada: falta una columna (ejecuta las migraciones: pnpm migration:run).',
  },
  '42P01': {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message:
      'La base de datos no está actualizada: falta una tabla (ejecuta las migraciones: pnpm migration:run).',
  },
});

// [translateKnownError]: error no-HTTP conocido → HttpException; null si es un fallo inesperado (sigue siendo 500 genérico, con stack en el log)
// [Seguridad]: nunca se devuelve el SQL ni `detail` (podría exponer datos); solo el campo/restricción, que ya conoce quien envió el formulario
export function translateKnownError(exception: unknown): HttpException | null {
  if (exception instanceof QueryFailedError) {
    const driver = (
      exception as QueryFailedError & {
        driverError?: { code?: string; column?: string; constraint?: string };
      }
    ).driverError;
    // [Fix 2026-10-28 · Sin duplicados]: índice único por título (migración TitleDedup, «UQ_title_<tabla>») → 409 con el mismo mensaje y código que la regla de la app (carrera entre dos altas)
    if (driver?.code === '23505' && driver.constraint?.startsWith('UQ_title_'))
      return new HttpException(
        {
          message:
            'Ya existe un registro con ese título para el mismo idioma y nivel. Cambia el título o edita el registro existente.',
          code: 'DUPLICATE_TITLE',
        },
        HttpStatus.CONFLICT,
      );
    const known = driver?.code ? PG_ERRORS[driver.code] : undefined;
    if (!known) return null;
    const where = driver?.column ?? driver?.constraint; // Campo o restricción afectada (p. ej. «key», «uq_curriculum_natural_key»)
    return new HttpException(
      {
        message: where ? `${known.message} (${where})` : known.message,
        code: `DB_${driver!.code}`, // `!` (TS): `known` implica que hay código
      },
      known.status,
    );
  }
  // [Sin conexión · 2026-10-30]: PostgreSQL u otro servicio interno caído (`connect ECONNREFUSED 127.0.0.1:5433`) → 503 legible, no «Internal server error» | `code` (Node.js): error de red del sistema
  if ((exception as { code?: unknown } | null)?.code === 'ECONNREFUSED')
    return new HttpException(
      {
        message:
          'Un servicio interno no responde (base de datos u otro). Comprueba que esté en marcha e inténtalo de nuevo.',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  // [body-parser / http-errors]: errores con `status` 4xx propio (413 cuerpo demasiado grande, 400 JSON mal formado)
  const e = exception as { status?: unknown; type?: unknown } | null;
  if (e && typeof e.status === 'number' && e.status >= 400 && e.status < 500) {
    const message =
      e.type === 'entity.too.large'
        ? 'El contenido es demasiado grande (imágenes o textos muy largos).'
        : e.type === 'entity.parse.failed'
          ? 'El cuerpo de la petición no es JSON válido.'
          : 'Petición no válida.';
    return new HttpException({ message }, e.status);
  }
  return null;
}
