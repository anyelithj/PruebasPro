import {
  CefrLevel,
  CEFR_LEVEL_LABEL_ES,
} from '../../../../shared/domain/cefr-level.vo';
import {
  Language,
  LANGUAGE_LABEL,
} from '../../../../shared/domain/language.vo';
// [VO CourseCategory / CourseGroup]: catálogo de cursos = idioma (grupo) × nivel MCER (categoría) | [Patrón]: Value Object (DDD) + Shared Kernel | [Principio]: SRP + OCP + SSOT | [Paradigma]: Declarativo
// [Tecnología]: TypeScript puro (sin NestJS/TypeORM) → dominio independiente del framework (Clean Architecture)
// [Legacy]: los valores del catálogo anterior (diplomados, STEM…) se conservan SOLO para que las filas existentes en PostgreSQL
// sigan siendo válidas (un enum de Postgres no permite quitar valores en uso). No se listan ni se ofrecen en la UI.

// `export enum` (TS): categoría fina del curso = nivel MCER; los valores legacy van marcados con `@deprecated` (JSDoc, el IDE los tacha)
export enum CourseCategory {
  A1 = 'A1', // Nivel MCER A1
  A2 = 'A2', // Nivel MCER A2
  B1 = 'B1', // Nivel MCER B1
  B2 = 'B2', // Nivel MCER B2
  C1 = 'C1', // Nivel MCER C1
  C2 = 'C2', // Nivel MCER C2
  /** @deprecated legacy */ DIPLOMADO_I = 'DIPLOMADO_I',
  /** @deprecated legacy */ DIPLOMADO_II = 'DIPLOMADO_II',
  /** @deprecated legacy */ DIPLOMADO_III = 'DIPLOMADO_III',
  /** @deprecated legacy */ DIPLOMADO_IV = 'DIPLOMADO_IV',
  /** @deprecated legacy */ DIPLOMADO_V = 'DIPLOMADO_V',
  /** @deprecated legacy */ DIPLOMADO_VI = 'DIPLOMADO_VI',
  /** @deprecated legacy */ DIPLOMADO_VII = 'DIPLOMADO_VII',
  /** @deprecated legacy */ DIPLOMADO_VIII = 'DIPLOMADO_VIII',
  /** @deprecated legacy */ DIPLOMADO_IX = 'DIPLOMADO_IX',
  /** @deprecated legacy */ DIPLOMADO_X = 'DIPLOMADO_X',
  /** @deprecated legacy */ DIPLOMADO_XI = 'DIPLOMADO_XI',
  /** @deprecated legacy */ DIPLOMADO_XII = 'DIPLOMADO_XII',
  /** @deprecated legacy */ MASTER_CLASS = 'MASTER_CLASS',
  /** @deprecated legacy */ FACULTAD_SUPERIOR = 'FACULTAD_SUPERIOR',
  /** @deprecated legacy */ FACULTAD_SUBORDINADA = 'FACULTAD_SUBORDINADA',
  /** @deprecated legacy */ COMPETENCIA_GENERAL_HUMANA = 'COMPETENCIA_GENERAL_HUMANA',
  /** @deprecated legacy */ COMPETENCIA_FUNDAMENTAL = 'COMPETENCIA_FUNDAMENTAL',
  /** @deprecated legacy */ COMPETENCIA_PRODUCTIVA = 'COMPETENCIA_PRODUCTIVA',
  /** @deprecated legacy */ DIMENSION_HUMANA = 'DIMENSION_HUMANA',
  /** @deprecated legacy */ PRINCIPIO_CIENTIFICO = 'PRINCIPIO_CIENTIFICO',
  /** @deprecated legacy */ VALOR_CIENTIFICO = 'VALOR_CIENTIFICO',
  /** @deprecated legacy */ STEM_SCIENCE = 'STEM_SCIENCE',
  /** @deprecated legacy */ STEM_TECHNOLOGY = 'STEM_TECHNOLOGY',
  /** @deprecated legacy */ STEM_ENGINEERING = 'STEM_ENGINEERING',
  /** @deprecated legacy */ STEM_ARTS = 'STEM_ARTS',
  /** @deprecated legacy */ STEM_MATHEMATICS = 'STEM_MATHEMATICS',
}

// `export enum` (TS): grupo = idioma del curso (chips de filtro del frontend)
export enum CourseGroup {
  EN = 'EN', // Inglés
  FR = 'FR', // Francés
  DE = 'DE', // Alemán
  ES = 'ES', // Español
  PT = 'PT', // Portugués
  ZH = 'ZH', // Chino mandarín
  RU = 'RU', // Ruso
  /** @deprecated legacy */ DIPLOMADO = 'DIPLOMADO',
  /** @deprecated legacy */ MASTER_CLASS = 'MASTER_CLASS',
  /** @deprecated legacy */ FACULTAD = 'FACULTAD',
  /** @deprecated legacy */ COMPETENCIA = 'COMPETENCIA',
  /** @deprecated legacy */ DIMENSION = 'DIMENSION',
  /** @deprecated legacy */ PRINCIPIO = 'PRINCIPIO',
  /** @deprecated legacy */ VALOR = 'VALOR',
  /** @deprecated legacy */ STEM = 'STEM',
}

// [Grupos vigentes]: `ReadonlyArray` (TS) + `Object.freeze` (JS) — lo único que se lista y se acepta al crear | [Principio]: SSOT
export const ACTIVE_COURSE_GROUPS: ReadonlyArray<CourseGroup> = Object.freeze([
  CourseGroup.EN,
  CourseGroup.FR,
  CourseGroup.DE,
  CourseGroup.ES,
  CourseGroup.PT,
  CourseGroup.ZH,
  CourseGroup.RU,
]);

// [Grupo → idioma del Shared Kernel]: `Partial<Record<...>>` (TS) porque los grupos legacy no tienen idioma | [Patrón]: Lookup Table
export const COURSE_GROUP_LANGUAGE: Readonly<
  Partial<Record<CourseGroup, Language>>
> = Object.freeze({
  [CourseGroup.EN]: Language.EN,
  [CourseGroup.FR]: Language.FR,
  [CourseGroup.DE]: Language.DE,
  [CourseGroup.ES]: Language.ES,
  [CourseGroup.PT]: Language.PT,
  [CourseGroup.ZH]: Language.ZH,
  [CourseGroup.RU]: Language.RU,
});

// [Categoría legacy → grupo legacy]: solo para editar filas antiguas sin romperlas | [Patrón]: Backward Compatibility
const LEGACY_CATEGORY_GROUP: Readonly<
  Partial<Record<CourseCategory, CourseGroup>>
> = Object.freeze({
  [CourseCategory.DIPLOMADO_I]: CourseGroup.DIPLOMADO,
  [CourseCategory.DIPLOMADO_II]: CourseGroup.DIPLOMADO,
  [CourseCategory.DIPLOMADO_III]: CourseGroup.DIPLOMADO,
  [CourseCategory.DIPLOMADO_IV]: CourseGroup.DIPLOMADO,
  [CourseCategory.DIPLOMADO_V]: CourseGroup.DIPLOMADO,
  [CourseCategory.DIPLOMADO_VI]: CourseGroup.DIPLOMADO,
  [CourseCategory.DIPLOMADO_VII]: CourseGroup.DIPLOMADO,
  [CourseCategory.DIPLOMADO_VIII]: CourseGroup.DIPLOMADO,
  [CourseCategory.DIPLOMADO_IX]: CourseGroup.DIPLOMADO,
  [CourseCategory.DIPLOMADO_X]: CourseGroup.DIPLOMADO,
  [CourseCategory.DIPLOMADO_XI]: CourseGroup.DIPLOMADO,
  [CourseCategory.DIPLOMADO_XII]: CourseGroup.DIPLOMADO,
  [CourseCategory.MASTER_CLASS]: CourseGroup.MASTER_CLASS,
  [CourseCategory.FACULTAD_SUPERIOR]: CourseGroup.FACULTAD,
  [CourseCategory.FACULTAD_SUBORDINADA]: CourseGroup.FACULTAD,
  [CourseCategory.COMPETENCIA_GENERAL_HUMANA]: CourseGroup.COMPETENCIA,
  [CourseCategory.COMPETENCIA_FUNDAMENTAL]: CourseGroup.COMPETENCIA,
  [CourseCategory.COMPETENCIA_PRODUCTIVA]: CourseGroup.COMPETENCIA,
  [CourseCategory.DIMENSION_HUMANA]: CourseGroup.DIMENSION,
  [CourseCategory.PRINCIPIO_CIENTIFICO]: CourseGroup.PRINCIPIO,
  [CourseCategory.VALOR_CIENTIFICO]: CourseGroup.VALOR,
  [CourseCategory.STEM_SCIENCE]: CourseGroup.STEM,
  [CourseCategory.STEM_TECHNOLOGY]: CourseGroup.STEM,
  [CourseCategory.STEM_ENGINEERING]: CourseGroup.STEM,
  [CourseCategory.STEM_ARTS]: CourseGroup.STEM,
  [CourseCategory.STEM_MATHEMATICS]: CourseGroup.STEM,
});

// [Regla de dominio]: un curso de nivel MCER necesita un idioma explícito; uno legacy deriva su grupo | [Patrón]: Domain Service (función pura) | [Paradigma]: Funcional
export function resolveCourseGroup(
  category: CourseCategory, // Nivel MCER o categoría legacy
  group?: CourseGroup, // `?` (TS): parámetro opcional → tipo `CourseGroup | undefined`
): CourseGroup {
  // `??` (ES2020): toma el grupo legacy mapeado; si no existe, el grupo recibido
  const resolved = LEGACY_CATEGORY_GROUP[category] ?? group;
  // `if (!x)`: sin grupo no hay idioma → invariante de dominio violada
  if (!resolved) {
    // `throw new Error` (JS): el caso de uso lo traduce a HTTP 400 en la capa de presentación
    throw new Error(`El curso de nivel ${category} requiere un idioma (group)`);
  }
  return resolved; // `return`: grupo final a persistir (denormalizado para filtros rápidos)
}

// [Etiqueta legible]: "Inglés · B1 · Umbral" para cursos vigentes; texto legacy para los antiguos | [Principio]: SSOT
export function courseCategoryLabel(
  category: CourseCategory,
  group: CourseGroup,
): string {
  const language = COURSE_GROUP_LANGUAGE[group]; // Idioma del grupo (undefined si es legacy)
  // `in` (JS): comprueba si la categoría es una clave de la tabla MCER (es decir, un nivel vigente)
  const level =
    category in CEFR_LEVEL_LABEL_ES
      ? CEFR_LEVEL_LABEL_ES[category as unknown as CefrLevel]
      : undefined;
  // Operador ternario `?:`: compone la etiqueta solo si ambos datos existen; si no, devuelve el valor crudo
  return language && level
    ? `${LANGUAGE_LABEL[language]} · ${level}`
    : category;
}

// [Type guards]: validan strings crudos (querystring/JSON) contra los enums | [Principio]: Type-Safe
export function isCourseCategory(value: string): value is CourseCategory {
  return Object.values(CourseCategory).includes(value as CourseCategory);
}

export function isCourseGroup(value: string): value is CourseGroup {
  return Object.values(CourseGroup).includes(value as CourseGroup);
}
