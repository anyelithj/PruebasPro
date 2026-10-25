// media.exception.ts => errores de dominio del módulo Media (cada uno con código estable para el frontend).
import { BadGatewayException, BadRequestException, UnprocessableException } from "../../../shared/filter/http-exception.filter";

// 400 => la petición no trae archivos en el campo esperado
export class NoFilesException extends BadRequestException {
  constructor() {
    super("Adjunta al menos una imagen en el campo 'files'", "NO_FILES");
  }
}

// 400 => MIME fuera de la lista blanca (Multer lo lanza antes de leer el archivo completo)
export class InvalidImageTypeException extends BadRequestException {
  constructor() {
    super("Formato de imagen no permitido", "INVALID_IMAGE_TYPE");
  }
}

// 400 => PATCH sin archivo nuevo ni metadatos: no hay nada que actualizar
// InappropriateImageException => RF-06.6 la moderación detectó contenido no apto (422: la entrada no es procesable)
export class InappropriateImageException extends UnprocessableException {
  constructor(category: string) {
    super("La imagen tiene contenido no apto para la tienda y no se publicó", "IMAGE_INAPPROPRIATE", { category });
  }
}

export class NothingToUpdateException extends BadRequestException {
  constructor() {
    super("Envía un archivo en 'file' o el texto alternativo 'alt'", "NOTHING_TO_UPDATE");
  }
}

// 502 => Cloudinary (servicio externo) falló; no es culpa del cliente
export class MediaUploadFailedException extends BadGatewayException {
  constructor() {
    super("No se pudo subir la imagen a Cloudinary", "MEDIA_UPLOAD_FAILED");
  }
}

// 502 => la Admin API de Cloudinary (listar, actualizar metadatos, borrar en lote) no respondió
export class MediaProviderException extends BadGatewayException {
  constructor() {
    super("Cloudinary no respondió; intenta de nuevo", "MEDIA_PROVIDER_FAILED");
  }
}
