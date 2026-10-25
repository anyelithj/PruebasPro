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

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : ((exceptionResponse as { message?: string | string[] }).message ??
          'Unexpected error');

    // [Envelope error]: forma estable para consumidores frontend
    const errorBody = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    // [Log diferenciado]: 5xx error, 4xx warn (no contamina alertas)
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} → ${status}: ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json(errorBody);
  }
}
