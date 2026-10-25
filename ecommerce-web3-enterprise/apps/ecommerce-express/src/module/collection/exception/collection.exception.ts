// collection.exception.ts => errores de dominio del módulo Collection.
import { NotFoundException } from "../../../shared/filter/http-exception.filter";

export class CollectionNotFoundException extends NotFoundException {
  constructor(idOrSlug: string) {
    super("Collection", idOrSlug);
  }
}
