import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
// [Interceptor de logging]: registra cada request con latencia | [Patrón]: Interceptor | [Principio]: SRP | [Paradigma]: AOP + Reactivo

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  // [intercept]: instrumenta el handler con timing | [Paradigma]: Reactivo
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    // [Marca temporal]: inicio antes de delegar al handler
    const started = Date.now();

    // [tap]: side effect sin transformar el stream | [Paradigma]: Reactivo
    return next.handle().pipe(
      tap({
        next: () => {
          const elapsed = Date.now() - started;
          this.logger.log(`${method} ${url} → ${elapsed}ms`);
        },
        error: (err: unknown) => {
          const elapsed = Date.now() - started;
          this.logger.warn(
            `${method} ${url} ✗ ${elapsed}ms · ${err instanceof Error ? err.message : String(err)}`,
          );
        },
      }),
    );
  }
}
