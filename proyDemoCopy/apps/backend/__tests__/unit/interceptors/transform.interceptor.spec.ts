import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { TransformInterceptor } from '../../../src/shared/interceptors/transform.interceptor';

function makeContext(url: string, statusCode: number): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ url }),
      getResponse: () => ({ statusCode }),
    }),
    getHandler: () => function handler() {}, // [Sprint 6.2]: isSse() lee la metadata @Sse del handler (aquí no la tiene → se envuelve)
  } as unknown as ExecutionContext;
}

describe('TransformInterceptor', () => {
  it('envuelve la respuesta en { statusCode, data, meta }', async () => {
    const interceptor = new TransformInterceptor<{ id: number }>();
    const payload = { id: 1 };
    const next: CallHandler = { handle: () => of(payload) };

    const result = await lastValueFrom(
      interceptor.intercept(makeContext('/api/v1/quiz', 200), next),
    );

    expect(result.statusCode).toBe(200);
    expect(result.data).toEqual(payload);
    expect(result.meta.path).toBe('/api/v1/quiz');
    expect(typeof result.meta.timestamp).toBe('string');
    expect(new Date(result.meta.timestamp).toISOString()).toBe(
      result.meta.timestamp,
    );
  });

  it('propaga el statusCode real de la respuesta', async () => {
    const interceptor = new TransformInterceptor();
    const next: CallHandler = { handle: () => of(null) };

    const result = await lastValueFrom(
      interceptor.intercept(makeContext('/x', 201), next),
    );

    expect(result.statusCode).toBe(201);
    expect(result.data).toBeNull();
  });
});
