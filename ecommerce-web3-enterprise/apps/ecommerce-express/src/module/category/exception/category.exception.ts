// category.exception.ts => errores de dominio del módulo Category (heredan de la jerarquía compartida, DRY).
import { ConflictException, NotFoundException } from "../../../shared/filter/http-exception.filter";

export class CategoryNotFoundException extends NotFoundException {
  constructor(idOrSlug: string) {
    super("Category", idOrSlug); // code => "CATEGORY_NOT_FOUND"
  }
}

// Mover una categoría debajo de sí misma o de un descendiente crearía un ciclo en el árbol (grafo inválido)
export class CategoryCycleException extends ConflictException {
  constructor() {
    super("Una categoría no puede ser hija de sí misma ni de una de sus subcategorías", "CATEGORY_CYCLE");
  }
}
