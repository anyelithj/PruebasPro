import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
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

    // [Status resolution]: HttpException expone status, otros = 500
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // [Mensaje normalizado]: HttpException.getResponse puede ser string u objeto
    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
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
    const expectedUnavailable =
      exception instanceof HttpException &&
      status === HttpStatus.SERVICE_UNAVAILABLE;
    if (status >= 500 && !expectedUnavailable) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (expectedUnavailable && code) {
      this.logger.debug(`${request.method} ${request.url} → ${status} ${code}`);
    } else {
      this.logger.warn(
        `${request.method} ${request.url} → ${status}: ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json(errorBody);
  }
}
