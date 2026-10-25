// permission.repository.ts => PATRÓN Repository sobre Prisma para el módulo Permission
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../../../config/database.config"; // Singleton compartido
import { PermissionEntity, type PermissionPersistenceShape } from "../model/permission.model";

export class PermissionRepository {
  private readonly prisma: PrismaClient;

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
  }

  // listPermissions => "listar permisos del sistema por módulo" (agrupable en el frontend por "resource")
  public async listPermissions(): Promise<PermissionEntity[]> {
    const rawPermissions = await this.prisma.permission.findMany({
      // "_count" => Prisma calcula el conteo de la relación SIN traer todas las filas relacionadas (eficiente)
      include: { _count: { select: { roles: true } } },
      orderBy: [{ resource: "asc" }, { action: "asc" }], // Orden compuesto: primero por recurso, luego por acción
    });

    return rawPermissions.map((rawPermission) => this.mapToEntity(rawPermission));
  }

  public async findById(id: string): Promise<PermissionEntity | null> {
    const rawPermission = await this.prisma.permission.findUnique({
      where: { id },
      include: { _count: { select: { roles: true } } },
    });

    if (!rawPermission) return null;
    return this.mapToEntity(rawPermission);
  }

  public async findByActionAndResource(action: string, resource: string): Promise<PermissionEntity | null> {
    const rawPermission = await this.prisma.permission.findUnique({
      where: { action_resource: { action, resource } }, // Nombre generado por Prisma para el @@unique compuesto
      include: { _count: { select: { roles: true } } },
    });

    if (!rawPermission) return null;
    return this.mapToEntity(rawPermission);
  }

  // createPermission => "crear permiso con acción y recurso"
  public async createPermission(data: {
    action: string;
    resource: string;
    description?: string | undefined;
  }): Promise<PermissionEntity> {
    const rawPermission = await this.prisma.permission.create({
      // "?? null" => con exactOptionalPropertyTypes Prisma no acepta "undefined" explícito
      data: { action: data.action, resource: data.resource, description: data.description ?? null },
      include: { _count: { select: { roles: true } } },
    });

    return this.mapToEntity(rawPermission);
  }

  // updatePermission => "modificar descripción del permiso — PATCH parcial"
  public async updatePermission(id: string, description: string): Promise<PermissionEntity> {
    const rawPermission = await this.prisma.permission.update({
      where: { id },
      data: { description },
      include: { _count: { select: { roles: true } } },
    });

    return this.mapToEntity(rawPermission);
  }

  public async deletePermissionById(id: string): Promise<void> {
    await this.prisma.permission.delete({ where: { id } });
  }

  private mapToEntity(rawPermission: {
    id: string;
    action: string;
    resource: string;
    description: string | null;
    createdAt: Date;
    _count: { roles: number };
  }): PermissionEntity {
    const shape: PermissionPersistenceShape = {
      id: rawPermission.id,
      action: rawPermission.action,
      resource: rawPermission.resource,
      description: rawPermission.description,
      createdAt: rawPermission.createdAt,
      rolesUsingCount: rawPermission._count.roles,
    };

    return new PermissionEntity(shape);
  }
}

export const permissionRepository = new PermissionRepository(prisma);
