// rbac.middleware.ts => autorización GRANULAR por permiso "ACCIÓN:recurso" (sprint 1.2 "Permisos granulares").
// Complementa requireRoles (auth.guard): en vez de "¿eres ADMIN?" pregunta "¿algún rol tuyo tiene UPDATE:product?".
// Así se crean roles nuevos desde la API (POST /role) sin tocar código (OCP).
// Patrón: Decorator configurable (Factory que devuelve un middleware) + Cache-Aside de permisos por conjunto de roles.
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../config/database.config";
import { RedisKeys } from "../../config/redis.config";
import { cached, invalidatePattern } from "../interceptor/cache.interceptor";
import type { Action, Resource } from "../constants/roles.constants";
import { ForbiddenException, UnauthorizedException } from "../filter/http-exception.filter";

const PERMISSIONS_TTL_SECONDS = 300; // 5 minutos: los cambios de permisos se propagan rápido sin consultar la DB en cada request

// expandRoleHierarchy => RF-03.1: roles del usuario + TODOS sus ancestros (un rol hereda los permisos de su padre,
// del padre de su padre...). Función PURA (sin I/O): recibe la tabla de roles y recorre la cadena de "parentId".
// El "Set" de visitados corta cualquier ciclo accidental (el service ya los impide al guardar: defensa en profundidad).
export function expandRoleHierarchy(roles: readonly string[], all: ReadonlyArray<{ id: string; name: string; parentId: string | null }>): string[] {
  const byName = new Map(all.map((role) => [role.name, role] as const)); // "as const" => tupla [clave, valor] para el Map
  const byId = new Map(all.map((role) => [role.id, role] as const));
  const result = new Set<string>();
  for (const name of roles) {
    let current = byName.get(name);
    // "while" => sube por la cadena de padres hasta la raíz o hasta un rol ya visitado
    while (current && !result.has(current.name)) {
      result.add(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
  }
  return [...result];
}

// loadPermissions => conjunto de "ACCIÓN:recurso" concedidos a una combinación de roles (incluye los heredados de
// sus roles padre). Dos consultas pequeñas (la tabla de roles es diminuta) y el resultado va a Redis (Cache-Aside)
export async function loadPermissions(roles: readonly string[]): Promise<Set<string>> {
  const list = await cached(RedisKeys.permissions(roles), PERMISSIONS_TTL_SECONDS, async () => {
    const hierarchy = await prisma.role.findMany({ select: { id: true, name: true, parentId: true } });
    const effective = expandRoleHierarchy(roles, hierarchy);
    const rows = await prisma.permission.findMany({
      // "some" => permisos que pertenezcan a AL MENOS un rol (propio o heredado) cuyo nombre esté en la lista
      where: { roles: { some: { role: { name: { in: effective } } } } },
      select: { action: true, resource: true },
    });
    return rows.map((row) => `${row.action}:${row.resource}`);
  });
  return new Set(list); // "Set" => búsqueda O(1) con .has()
}

// invalidatePermissionsCache => se llama al modificar roles/permisos (role.service / permission.service)
export async function invalidatePermissionsCache(): Promise<void> {
  await invalidatePattern("rbac:perms:*");
}

// requirePermission => uso: router.patch("/:id", jwtAuthGuard, requirePermission("UPDATE", "product"), handler)
export function requirePermission(action: Action, resource: Resource) {
  // El closure captura action/resource; el middleware devuelto es asíncrono
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) return next(new UnauthorizedException());

    // ".then/.catch" => se encadena la promesa sin convertir el middleware en async (Express 4 no captura rechazos)
    loadPermissions(user.roles)
      .then((permissions) => {
        if (permissions.has(`${action}:${resource}`)) return next();
        next(new ForbiddenException(`Requiere el permiso ${action}:${resource}`));
      })
      .catch(next);
  };
}
