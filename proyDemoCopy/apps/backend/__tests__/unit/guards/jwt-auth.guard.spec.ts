import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../../src/shared/guards/jwt-auth.guard';

function makeContext(headers: Record<string, string> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
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

  // [Caso F · 2026-11-13]: autenticación OPCIONAL en rutas públicas → el catálogo ve al usuario y devuelve su ⭐/👍/❤️
  describe('ruta @Public con «Authorization: Bearer»', () => {
    const proto = () => Object.getPrototypeOf(Object.getPrototypeOf(guard));

    it('token válido → delega en passport (rellena request.user) y deja pasar', async () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const spy = jest.spyOn(proto(), 'canActivate').mockResolvedValue(true as never);
      await expect(guard.canActivate(makeContext({ authorization: 'Bearer abc.def.ghi' }))).resolves.toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('token inválido o vencido → sigue como visitante (nunca 401 en una ruta pública)', async () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const spy = jest.spyOn(proto(), 'canActivate').mockRejectedValue(new Error('jwt expired') as never);
      await expect(guard.canActivate(makeContext({ authorization: 'Bearer vencido' }))).resolves.toBe(true);
      spy.mockRestore();
    });
  });
});
