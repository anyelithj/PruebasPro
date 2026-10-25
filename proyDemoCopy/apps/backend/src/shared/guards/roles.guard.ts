import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import {
  Role,
  hasRolePrivilege,
} from '../../modules/users/domain/value-objects/role.vo';
import { JwtPayload } from '../decorators/current-user.decorator';
// [Guard de roles RBAC]: valida si el usuario actual cumple privilegio mínimo | [Patrón]: Guard + Strategy | [Principio]: SRP | [Paradigma]: AOP

@Injectable()
export class RolesGuard implements CanActivate {
  // [DI Reflector]: para leer @Roles del handler/clase | [Principio]: DIP
  constructor(private readonly reflector: Reflector) {}

  // [canActivate]: contrato CanActivate de Nest | [Patrón]: Strategy
  canActivate(context: ExecutionContext): boolean {
    // [Roles requeridos]: undefined = endpoint sin restricción de rol
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    // [Usuario actual]: poblado previamente por JwtAuthGuard via passport
    const { user } = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    if (!user) throw new ForbiddenException('User not authenticated');

    // [Privilegio mínimo]: si requiere TEACHER, ADMIN también pasa (jerarquía)
    const granted = required.some((r) => hasRolePrivilege(user.role, r));
    if (!granted) {
      throw new ForbiddenException(
        `Required role: ${required.join(' | ')}. Current: ${user.role}`,
      );
    }
    return true;
  }
}
