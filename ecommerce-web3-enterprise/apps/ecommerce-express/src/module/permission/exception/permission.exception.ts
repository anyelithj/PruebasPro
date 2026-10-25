// permission.exception.ts => jerarquía de errores del módulo Permission
export abstract class PermissionException extends Error {
  public abstract readonly statusCode: number;
  public abstract readonly code: string;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;
  }
}

export class PermissionNotFoundException extends PermissionException {
  public readonly statusCode = 404;
  public readonly code = "PERMISSION_NOT_FOUND";
  constructor(id: string) {
    super(`Permiso con id ${id} no encontrado`);
  }
}

export class PermissionAlreadyExistsException extends PermissionException {
  public readonly statusCode = 409;
  public readonly code = "PERMISSION_ALREADY_EXISTS";
  constructor(action: string, resource: string) {
    super(`El permiso ${action}:${resource} ya existe`);
  }
}

export class PermissionInUseException extends PermissionException {
  public readonly statusCode = 409;
  public readonly code = "PERMISSION_IN_USE";
  constructor(rolesCount: number) {
    super(`No se puede eliminar: el permiso está asignado a ${rolesCount} rol(es)`);
  }
}
