// cache.error.ts (TypeScript) => errores de dominio del Cache Service; el error.middleware los traduce a HTTP.
// Patrón Factory Method sobre DomainException: un método estático por caso (KeyNotFound, TtlExpired, PatternInvalid).
import { DomainException } from "../../../shared/filter/http-exception.filter";

export class CacheError extends DomainException {
  // "static" => se invoca sobre la clase: "throw CacheError.keyNotFound(key)"
  public static keyNotFound(key: string): CacheError {
    return new CacheError(404, "CACHE_KEY_NOT_FOUND", `La clave ${key} no está en caché`);
  }

  // ttlExpired => PUT sin ttl_seconds sobre una clave que venció entre la lectura y la escritura
  public static ttlExpired(key: string): CacheError {
    return new CacheError(410, "CACHE_TTL_EXPIRED", `La clave ${key} venció; envía ttl_seconds para recrearla`);
  }

  public static patternInvalid(pattern: string): CacheError {
    return new CacheError(400, "CACHE_PATTERN_INVALID", `Patrón inválido: ${pattern}`);
  }
}
