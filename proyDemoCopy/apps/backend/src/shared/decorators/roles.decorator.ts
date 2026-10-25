import { SetMetadata } from '@nestjs/common';
import { Role } from '../../modules/users/domain/value-objects/role.vo';
// [Decorator @Roles]: declara roles requeridos para un endpoint | [Patrón]: Decorator + Marker | [Paradigma]: AOP

// [Clave metadata]: leída por RolesGuard
export const ROLES_KEY = 'roles';

// [Factory de @Roles]: variádica para múltiples roles | [Principio]: OCP — añadir roles sin tocar guard
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
