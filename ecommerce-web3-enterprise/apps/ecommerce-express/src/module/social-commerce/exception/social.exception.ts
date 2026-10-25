// social.exception.ts => errores de dominio del módulo Social Commerce (mapeados por error.middleware).
import { ConflictException, NotFoundException, ServiceUnavailableException, UnprocessableException } from "../../../shared/filter/http-exception.filter";
import type { SocialPlatform } from "../model/social.model";

export class SocialPostNotFoundException extends NotFoundException {
  constructor(id: string) {
    super("Social post", id); // 404 SOCIAL_POST_NOT_FOUND
  }
}

// 409 => una publicación ya publicada en redes no se edita (las redes no permiten cambiar la imagen)
export class SocialPostNotEditableException extends ConflictException {
  constructor(status: string) {
    super(`No se puede editar una publicación en estado ${status}`, "SOCIAL_POST_NOT_EDITABLE");
  }
}

// 503 => la red pedida no tiene credenciales configuradas (convención del proyecto para integraciones opcionales)
export class SocialPlatformUnavailableException extends ServiceUnavailableException {
  constructor(platform: SocialPlatform) {
    super(`${platform} no está configurado en el servidor`);
  }
}

// 422 => productos etiquetados inexistentes, inactivos o de otro vendedor
export class InvalidTaggedProductsException extends UnprocessableException {
  constructor(ids: string[]) {
    super("Hay productos etiquetados que no existen o no te pertenecen", "INVALID_TAGGED_PRODUCTS", { ids });
  }
}
