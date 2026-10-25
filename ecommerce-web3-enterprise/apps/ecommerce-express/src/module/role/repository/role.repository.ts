// role.repository.ts => PATRÓN Repository sobre Prisma para el módulo Role
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../../config/database.config"; // Singleton compartido (antes: new PrismaClient() por módulo)
import { RoleEntity, type RolePersistenceShape } from "../model/role.model";

// ROLE_INCLUDE => permisos + nombre del rol padre en la MISMA consulta (DRY: lo usan todas las lecturas)
const ROLE_INCLUDE = { permissions: { include: { permission: true } }, parent: { select: { name: true } } } satisfies Prisma.RoleInclude;

export class RoleRepository {
  private readonly prisma: PrismaClient;

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
  }

  // listRoles => "listar roles disponibles" (endpoint GET /api/v1/role)
  public async listRoles(): Promise<RoleEntity[]> {
    const rawRoles = await this.prisma.role.findMany({
      // "include" anidado: Role -> RolePermission -> Permission (2 niveles de relación)
      include: ROLE_INCLUDE,
      orderBy: { name: "asc" },
    });

    return rawRoles.map((rawRole) => this.mapToEntity(rawRole));
  }

  public async findById(id: string): Promise<RoleEntity | null> {
    const rawRole = await this.prisma.role.findUnique({
      where: { id },
      include: ROLE_INCLUDE,
    });

    if (!rawRole) return null;
    return this.mapToEntity(rawRole);
  }

  public async findByName(name: string): Promise<RoleEntity | null> {
    const rawRole = await this.prisma.role.findUnique({
      where: { name },
      include: ROLE_INCLUDE,
    });

    if (!rawRole) return null;
    return this.mapToEntity(rawRole);
  }

  // createRole => "crear rol con permisos definidos"
  public async createRole(data: {
    name: string;
    description?: string | undefined;
    permissionIds?: string[] | undefined;
    parentId?: string | null | undefined;
  }): Promise<RoleEntity> {
    const rawRole = await this.prisma.role.create({
      data: {
        name: data.name,
        description: data.description ?? null, // "?? null" => Prisma no acepta undefined explícito con exactOptionalPropertyTypes
        parentId: data.parentId ?? null, // RF-03.1
        // "permissionIds?.map(...) ?? []" => si no vienen permisos, crea el rol sin ninguno (array vacío)
        permissions: {
          create: (data.permissionIds ?? []).map((permissionId) => ({ permissionId })),
        },
      },
      include: ROLE_INCLUDE,
    });

    return this.mapToEntity(rawRole);
  }

  // updateRole => "modificar nombre y/o permisos — PATCH parcial"
  public async updateRole(
    id: string,
    changes: { name?: string | undefined; description?: string | undefined; permissionIds?: string[] | undefined; parentId?: string | null | undefined }
  ): Promise<RoleEntity> {
    // "$transaction" => PATRÓN Unit of Work: si el reemplazo de permisos falla, se revierte TODO (atomicidad)
    const rawRole = await this.prisma.$transaction(async (tx) => {
      // Si vienen permissionIds nuevos, se reemplaza la relación completa (borrar + recrear)
      if (changes.permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({
          data: changes.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
        });
      }

      return tx.role.update({
        where: { id },
        // Spread condicional: solo se incluyen en el UPDATE los campos que llegaron (semántica PATCH)
        data: {
          ...(changes.name !== undefined ? { name: changes.name } : {}),
          ...(changes.description !== undefined ? { description: changes.description } : {}),
          ...(changes.parentId !== undefined ? { parentId: changes.parentId } : {}), // null => quitar el padre
        },
        include: ROLE_INCLUDE,
      });
    });

    return this.mapToEntity(rawRole);
  }

  // ancestorIds => cadena de padres de un rol (RF-03.1, regla anti-ciclos). La tabla de roles es pequeña: se lee
  // completa una vez y se recorre en memoria (1 consulta en vez de una por nivel)
  public async ancestorIds(roleId: string): Promise<string[]> {
    const parentOf = new Map((await this.prisma.role.findMany({ select: { id: true, parentId: true } })).map((role) => [role.id, role.parentId] as const));
    const chain: string[] = [];
    // "for (;;)" con corte por ciclo: el Set de la cadena evita bucles infinitos con datos corruptos
    for (let current = parentOf.get(roleId) ?? null; current && !chain.includes(current); current = parentOf.get(current) ?? null) chain.push(current);
    return chain;
  }

  // countUsersWithRole => necesario para la regla de negocio "no eliminar rol en uso"
  public async countUsersWithRole(roleId: string): Promise<number> {
    return this.prisma.userRole.count({ where: { roleId } });
  }

  public async deleteRoleById(id: string): Promise<void> {
    await this.prisma.role.delete({ where: { id } });
  }

  private mapToEntity(rawRole: Prisma.RoleGetPayload<{ include: typeof ROLE_INCLUDE }>): RoleEntity {
    const shape: RolePersistenceShape = {
      id: rawRole.id,
      name: rawRole.name,
      description: rawRole.description,
      parentId: rawRole.parentId,
      parentName: rawRole.parent?.name ?? null,
      createdAt: rawRole.createdAt,
      // ".map()" aplana la relación anidada RolePermission->Permission a un array simple de Permission
      permissions: rawRole.permissions.map((rolePermission) => rolePermission.permission),
    };

    return new RoleEntity(shape);
  }
}

export const roleRepository = new RoleRepository(prisma);
