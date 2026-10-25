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
