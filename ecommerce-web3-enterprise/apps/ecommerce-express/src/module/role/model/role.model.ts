import type { RoleResponseDto } from "../dto/role.dto";

// role.model.ts => entidad de dominio Role (POO), aplica patrón Composite conceptual:
// un Role "compone" una colección de Permission, y se pregunta sobre el conjunto como un todo.
export interface RolePersistenceShape {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null; // RF-03.1: rol del que hereda permisos
  parentName: string | null;
  permissions: Array<{ id: string; action: string; resource: string }>;
  createdAt: Date;
}

export class RoleEntity {
  public readonly id: string;
  public readonly name: string;
  public readonly description: string | null;
  public readonly parentId: string | null;
  public readonly parentName: string | null;
  private readonly permissions: Array<{ id: string; action: string; resource: string }>;
  public readonly createdAt: Date;

  constructor(data: RolePersistenceShape) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.parentId = data.parentId;
    this.parentName = data.parentName;
    this.permissions = data.permissions;
    this.createdAt = data.createdAt;
  }

  // Regla de negocio: el rol "ADMIN" es protegido — nunca se puede eliminar (integridad del sistema)
  public isProtectedRole(): boolean {
    // ".includes()" comprueba pertenencia a una lista fija de roles críticos del sistema
    return ["ADMIN"].includes(this.name);
  }

  // Regla de negocio: "eliminar rol validando que no esté en uso" (matriz Excel, endpoint DELETE)
  // Aquí solo se expone el criterio; la verificación real de "en uso" requiere una query al Repository
  // (se combina en el Service, que sí tiene acceso a ambos datos)
  public canBeDeleted(usersAssignedCount: number): boolean {
    return !this.isProtectedRole() && usersAssignedCount === 0;
  }

  // Comprueba si el rol ya posee un permiso específico (action + resource) — evita duplicados al asignar
  public hasPermission(action: string, resource: string): boolean {
    return this.permissions.some((permission) => permission.action === action && permission.resource === resource);
  }

  // RF-03.1 regla anti-ciclos: "ancestors" = ids de la cadena de padres del candidato. Si este rol aparece en ella
  // (o el candidato es él mismo), asignarlo como padre crearía un ciclo A -> B -> A. Función pura sobre datos
  public createsCycleWith(candidateParentId: string, ancestorsOfCandidate: readonly string[]): boolean {
    return candidateParentId === this.id || ancestorsOfCandidate.includes(this.id);
  }

  public toResponseJSON(): RoleResponseDto {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      parentId: this.parentId,
      parentName: this.parentName,
      permissions: this.permissions,
      createdAt: this.createdAt,
    };
  }
}
