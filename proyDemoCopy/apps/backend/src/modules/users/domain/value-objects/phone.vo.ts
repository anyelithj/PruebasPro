// [Teléfono · 2026-10-24]: regla ÚNICA del teléfono del usuario (registro, Mi perfil y Gestión → usuarios) | [Patrón]: Value Object (constantes de dominio) | [Principio]: SSOT + DRY (antes la regex estaba copiada en 3 DTOs) | [Paradigma]: Declarativo
// [Espejo del frontend]: packages/shared-schemas (PHONE_PATTERN) la usa Next.js con Zod → misma regla en cliente y servidor

// `export const` (ES2015): binding inmutable exportado como módulo ES
// [Regex permisiva E.164-ish]: `^` / `$` anclan la cadena completa · `\+?` «+» inicial opcional · `[0-9 ()-]` dígitos, espacio, paréntesis y guion · `{7,20}` longitud · `(...)?` todo opcional → cadena vacía = «sin teléfono»
export const PHONE_PATTERN = /^(\+?[0-9 ()-]{7,20})?$/;

// [Longitud de la columna]: coincide con `varchar(30)` de la migración UserPhone1791992300000 (margen sobre los 21 caracteres que admite la regex)
export const PHONE_MAX_LENGTH = 30;

// [Mensaje de validación]: texto único que devuelven todos los DTOs | `as const` (TS): literal inmutable
export const PHONE_INVALID_MESSAGE =
  'Teléfono no válido (solo números, espacios, guiones y + inicial).' as const;

// [Ejemplo para Swagger/placeholder]: formato internacional con indicativo de país
export const PHONE_EXAMPLE = '+57 300 123 4567' as const;
