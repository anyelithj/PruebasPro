// supplier.exception.ts => errores de dominio del módulo Suppliers (mapeados por error.middleware).
import { ConflictException, NotFoundException } from "../../../shared/filter/http-exception.filter";

export class SupplierNotFoundException extends NotFoundException {
  constructor(id: string) {
    super("Supplier", id); // 404 SUPPLIER_NOT_FOUND
  }
}

// 409 => ya existe un proveedor con el mismo NIT (UNIQUE taxId)
export class SupplierTaxIdTakenException extends ConflictException {
  constructor() {
    super("Ya existe un proveedor con ese NIT", "SUPPLIER_TAX_ID_TAKEN");
  }
}
