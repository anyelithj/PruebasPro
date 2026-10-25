// search.exception.ts => errores de dominio del módulo Search.
import { BadRequestException, ServiceUnavailableException } from "../../../shared/filter/http-exception.filter";

// El motor de visión (FastAPI) no respondió: la búsqueda por texto sigue funcionando (degradación parcial)
export class VisionEngineUnavailableException extends ServiceUnavailableException {
  constructor() {
    super("La búsqueda por imagen no está disponible en este momento");
  }
}

export class MissingImageException extends BadRequestException {
  constructor() {
    super("Adjunta una imagen en el campo 'file'", "MISSING_IMAGE");
  }
}
