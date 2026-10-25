import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '../../modules/users/domain/value-objects/role.vo';
// [Decorator @CurrentUser]: inyecta el usuario autenticado en el handler | [Patrón]: Param Decorator | [Paradigma]: AOP

// [Payload JWT]: forma del subject decodificado por JwtStrategy.validate
export interface JwtPayload {
  // [sub]: ID estable del usuario (UUID)
  sub: string;
  email: string;
  role: Role;
  // [iat/exp]: emitidos por @nestjs/jwt automáticamente
  iat?: number;
  exp?: number;
}

// [Param decorator]: extrae request.user inyectado por JwtStrategy | [Principio]: DRY
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    // [Acceso a request HTTP]: switchToHttp soporta REST + GraphQL adapters
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    return request.user;
  },
);
