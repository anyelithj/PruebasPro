// user.exception.ts => jerarquía de errores del módulo User (antes vivían dentro de user.service.ts y
// algunos casos lanzaban "Error" genérico, que el middleware devolvía como 500 en vez de 4xx).
// Patrón Exception Hierarchy: heredan de AppException (shared/filter) => formato de error uniforme (DRY).
import { AppException } from "../../../shared/filter/http-exception.filter";

export class UserNotFoundException extends AppException {
  public readonly statusCode = 404;
  public readonly code = "USER_NOT_FOUND";
  constructor(id: string) {
    super(`Usuario con id ${id} no encontrado`);
  }
}

export class InvalidCurrentPasswordException extends AppException {
  public readonly statusCode = 400;
  public readonly code = "INVALID_CURRENT_PASSWORD";
  constructor() {
    super("La contraseña actual no es correcta");
  }
}

export class AccountAlreadyDeactivatedException extends AppException {
  public readonly statusCode = 409;
  public readonly code = "ACCOUNT_ALREADY_DEACTIVATED";
  constructor() {
    super("La cuenta ya se encuentra desactivada");
  }
}

export class InvalidPhoneFormatException extends AppException {
  public readonly statusCode = 400;
  public readonly code = "INVALID_PHONE_FORMAT";
  constructor() {
    super("Formato de teléfono colombiano inválido");
  }
}

// Protección: un administrador no puede quitarse a sí mismo el rol ADMIN ni desactivarse (evita quedar sin admins)
export class SelfLockoutException extends AppException {
  public readonly statusCode = 409;
  public readonly code = "SELF_LOCKOUT";
  constructor(action: string) {
    super(`No puedes ${action} tu propia cuenta de administrador`);
  }
}

export class AddressNotFoundException extends AppException {
  public readonly statusCode = 404;
  public readonly code = "ADDRESS_NOT_FOUND";
  constructor(id: string) {
    super(`Dirección ${id} no encontrada`);
  }
}
