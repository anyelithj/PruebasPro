// brand.exception.ts => errores de dominio del módulo Brand (heredan de la jerarquía compartida).
import { ConflictException, NotFoundException } from "../../../shared/filter/http-exception.filter";

export class BrandNotFoundException extends NotFoundException {
  constructor(idOrSlug: string) {
    super("Brand", idOrSlug);
  }
}

// Regla de la matriz: "eliminar marca sin productos activos"
export class BrandHasActiveProductsException extends ConflictException {
  constructor(count: number) {
    super(`La marca tiene ${count} producto(s) activo(s); archívalos o reasígnalos primero`, "BRAND_HAS_ACTIVE_PRODUCTS");
  }
}
