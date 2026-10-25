// crm.exception.ts => errores de dominio del módulo CRM (mapeados por error.middleware).
import { ConflictException, NotFoundException } from "../../../shared/filter/http-exception.filter";

export class CustomerNotFoundException extends NotFoundException {
  constructor(id: string) {
    super("Customer", id); // 404 CUSTOMER_NOT_FOUND
  }
}

// 409 => ya existe una cuenta con ese email (el CRM no duplica clientes)
export class CustomerEmailTakenException extends ConflictException {
  constructor() {
    super("Ya existe un cliente con ese email", "CUSTOMER_EMAIL_TAKEN");
  }
}
