// [@aula/shared-schemas · Sprint 7.1 · RF-86]: valores del dominio que comparten los contratos de Next.js y Angular (idiomas, niveles MCER, roles e idiomas de la interfaz) | [Patrón]: Schema-First (los esquemas Zod de cada app se construyen con estas tuplas: `z.enum(LANGUAGES)`) | [Principio]: SSOT + DRY (antes repetidos en constants.ts, session.service.ts, assistant.ts y help.ts) | [Paradigma]: Declarativo
// [Sin dependencias de runtime]: Zod lo aporta cada app (Next.js y Angular tienen su propia instalación) → el paquete se resuelve por alias sin node_modules propio
// [Espejo del backend]: Language (NestJS shared/domain/language.vo.ts), CefrLevel y Role (users/domain/value-objects/role.vo.ts)

// `as const` (TS): tuplas de literales inmutables → aptas para `z.enum(...)` y para tipos unión
export const LANGUAGES = ["en", "fr", "de", "es", "pt", "zh", "ru"] as const; // Idiomas que se enseñan (códigos ISO 639-1)
export type Language = (typeof LANGUAGES)[number];

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const; // Marco Común Europeo de Referencia
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const ROLES = ["USER", "TEACHER", "ADMIN"] as const; // Roles del backend (RBAC)
export type Role = (typeof ROLES)[number];

// [AUDIENCES]: a quién va dirigido un contenido de ayuda (FAQ, manual): todos o un rol concreto
export const AUDIENCES = ["ALL", ...ROLES] as const;
export type Audience = (typeof AUDIENCES)[number];

// [Teléfono del usuario · 2026-10-24]: regla compartida por registro, Mi perfil y Gestión → usuarios (Zod: `z.string().regex(PHONE_PATTERN)`) | [Principio]: SSOT + DRY (antes la regex estaba copiada en cada formulario)
// [Espejo del backend]: users/domain/value-objects/phone.vo.ts (NestJS valida con la MISMA regex en `@OptionalPhone`)
// [Regex permisiva E.164-ish]: `\+?` «+» inicial opcional · `[0-9 ()-]` dígitos, espacio, paréntesis y guion · `{7,20}` longitud · `(...)?` → cadena vacía válida = «sin teléfono»
export const PHONE_PATTERN = /^(\+?[0-9 ()-]{7,20})?$/;
export const PHONE_MAX_LENGTH = 21; // `maxLength` del <input>: «+» + 20 caracteres que admite la regex
export const PHONE_PLACEHOLDER = "+57 300 123 4567"; // Ejemplo con indicativo de país (Colombia)

// [READING_GENRES · Lectura · 2026-10-25]: géneros de los textos de lectura (espejo de ReadingGenre de NestJS: reading/domain/reading-genre.ts) | `as const` → `z.enum(READING_GENRES)` y tipo unión
export const READING_GENRES = ["tale", "fable", "animals", "poem", "news", "dialogue", "biography", "legend"] as const;
export type ReadingGenre = (typeof READING_GENRES)[number];
