// permission.model.ts => entidad de dominio Permission (POO), unidad mínima e indivisible del RBAC
export interface PermissionPersistenceShape {
  id: string;
  action: string;
  resource: string;
  description: string | null;
  createdAt: Date;
  rolesUsingCount: number; // Cuántos roles ya usan este permiso (necesario para la regla "eliminar si no está asignado")
}

export class PermissionEntity {
  public readonly id: string;
  public readonly action: string;
  public readonly resource: string;
  public readonly description: string | null;
  public readonly createdAt: Date;
  private readonly rolesUsingCount: number;

  constructor(data: PermissionPersistenceShape) {
    this.id = data.id;
    this.action = data.action;
    this.resource = data.resource;
    this.description = data.description;
    this.createdAt = data.createdAt;
    this.rolesUsingCount = data.rolesUsingCount;
  }

  // Regla de negocio: "eliminar permiso si no está asignado" (matriz Excel, endpoint DELETE)
  public canBeDeleted(): boolean {
    return this.rolesUsingCount === 0;
  }

  // Cantidad de roles que usan el permiso (se informa en el error al intentar eliminarlo)
  public get rolesCount(): number {
    return this.rolesUsingCount;
  }

  // Identificador legible combinando acción+recurso (ej. "CREATE:product"), útil para logs/auditoría
  public get code(): string {
    return `${this.action}:${this.resource}`;
  }

  public toResponseJSON(): {
    id: string;
    action: string;
    resource: string;
    description: string | null;
    createdAt: Date;
  } {
    return {
      id: this.id,
      action: this.action,
      resource: this.resource,
      description: this.description,
      createdAt: this.createdAt,
    };
  }
}
