import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../../src/shared/guards/roles.guard';
import { Role } from '../../../src/modules/users/domain/value-objects/role.vo';

function makeContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('permite paso cuando no hay roles requeridos (undefined)', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(makeContext({ role: Role.USER }))).toBe(true);
  });

  it('permite paso cuando la lista de roles esta vacia', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(makeContext({ role: Role.USER }))).toBe(true);
  });

  it('lanza ForbiddenException si no hay usuario autenticado', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.USER]);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('permite acceso si el rol cumple el privilegio exacto', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.TEACHER]);
    expect(guard.canActivate(makeContext({ role: Role.TEACHER }))).toBe(true);
  });

  it('permite acceso por jerarquia: ADMIN cumple requisito TEACHER', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.TEACHER]);
    expect(guard.canActivate(makeContext({ role: Role.ADMIN }))).toBe(true);
  });

  it('deniega acceso si el rol es insuficiente: USER vs TEACHER', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.TEACHER]);
    expect(() => guard.canActivate(makeContext({ role: Role.USER }))).toThrow(
      ForbiddenException,
    );
  });
});
