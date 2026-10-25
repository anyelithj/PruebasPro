// [Value Object CefrLevel]: los 6 niveles del Marco Común Europeo de Referencia (MCER/CEFR) | [Patrón]: Value Object + Shared Kernel (DDD) | [Principio]: SSOT + SRP | [Paradigma]: Declarativo
// [Tecnología]: TypeScript puro — sin dependencias de framework, reutilizable por quiz, courses y curriculum (Clean Architecture: el dominio no depende de NestJS/TypeORM)

// `export enum` (TS): conjunto cerrado de constantes con nombre; con valores string se serializa legible en BD/JSON
export enum CefrLevel {
  A1 = 'A1', // Usuario básico — acceso
  A2 = 'A2', // Usuario básico — plataforma
  B1 = 'B1', // Usuario independiente — umbral
  B2 = 'B2', // Usuario independiente — avanzado
  C1 = 'C1', // Usuario competente — dominio operativo eficaz
  C2 = 'C2', // Usuario competente — maestría
}

// [Orden canónico]: `ReadonlyArray<T>` (TS) impide push/splice en compilación; `Object.freeze` (JS) lo impide en runtime | [Principio]: Inmutabilidad
export const CEFR_LEVELS: ReadonlyArray<CefrLevel> = Object.freeze([
  CefrLevel.A1,
  CefrLevel.A2,
  CefrLevel.B1,
  CefrLevel.B2,
  CefrLevel.C1,
  CefrLevel.C2,
]);

// [Descriptor oficial por banda]: `Readonly<Record<K, V>>` (TS) = diccionario tipado y de solo lectura | [Patrón]: Lookup Table
export const CEFR_LEVEL_LABEL_ES: Readonly<Record<CefrLevel, string>> =
  Object.freeze({
    [CefrLevel.A1]: 'A1 · Acceso', // `[expr]:` (ES2015) = computed property name, usa el valor del enum como clave
    [CefrLevel.A2]: 'A2 · Plataforma',
    [CefrLevel.B1]: 'B1 · Umbral',
    [CefrLevel.B2]: 'B2 · Avanzado',
    [CefrLevel.C1]: 'C1 · Dominio operativo eficaz',
    [CefrLevel.C2]: 'C2 · Maestría',
  });

// [Type guard]: `value is CefrLevel` (TS) estrecha el tipo en el llamador cuando devuelve true | [Principio]: Type-Safe
export function isCefrLevel(value: string): value is CefrLevel {
  // `Object.values` (ES2017): lista los valores del enum; `includes` (ES2016): pertenencia O(n) sobre 6 elementos
  return Object.values(CefrLevel).includes(value as CefrLevel);
}

// [Comparación ordinal]: permite reglas como "no bajar de nivel" o "progresión A1→C2" | [Paradigma]: Funcional (función pura, sin efectos)
export function compareCefr(a: CefrLevel, b: CefrLevel): number {
  // `indexOf` sobre el orden canónico convierte el nivel en un número comparable
  return CEFR_LEVELS.indexOf(a) - CEFR_LEVELS.indexOf(b);
}

// [Color por nivel · Sprint 7.8]: acento (`color`) y fondo oscuro (`deep`) de cada banda — PDF del certificado | [Patrón]: Lookup Table | [Principio]: SSOT (espejo de packages/ui-tokens/cefr-colors.ts que usan Next.js y Angular)
// [Progresión]: verde (A1) → turquesa → azul → morado de marca → magenta → oro (C2) · el nivel siempre va también en texto (no solo color)
export interface CefrColor {
  readonly color: string;
  readonly deep: string;
}
export const CEFR_LEVEL_COLOR: Readonly<Record<CefrLevel, CefrColor>> =
  Object.freeze({
    [CefrLevel.A1]: { color: '#22C55E', deep: '#166534' },
    [CefrLevel.A2]: { color: '#14B8A6', deep: '#0F5560' },
    [CefrLevel.B1]: { color: '#1B7EC8', deep: '#12507F' },
    [CefrLevel.B2]: { color: '#8B5CF6', deep: '#2A0D7A' },
    [CefrLevel.C1]: { color: '#EC4899', deep: '#831843' },
    [CefrLevel.C2]: { color: '#D4A017', deep: '#8B6914' },
  });
export const NEUTRAL_LEVEL_COLOR: CefrColor = {
  color: '#6D28D9',
  deep: '#2A0D7A',
}; // Cursos sin banda MCER → morado de marca
