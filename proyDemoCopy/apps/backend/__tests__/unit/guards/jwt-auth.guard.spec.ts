import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../../src/shared/guards/jwt-auth.guard';

function makeContext(): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: {} }),
      getResponse: () => ({}),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new JwtAuthGuard(reflector as unknown as Reflector);
  });

  it('cortocircuita y permite acceso en rutas @Public', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('delega en passport (super.canActivate) cuando la ruta no es publica', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(guard));
    const superSpy = jest
      .spyOn(proto, 'canActivate')
      .mockReturnValue('delegated' as never);

    const result = guard.canActivate(makeContext());

    expect(superSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe('delegated');
    superSpy.mockRestore();
  });
});
