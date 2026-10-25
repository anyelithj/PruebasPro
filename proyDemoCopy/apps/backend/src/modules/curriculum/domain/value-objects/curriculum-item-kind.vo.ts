// [Value Object CurriculumItemKind]: tipos de recurso pedagógico que el autor introduce manualmente | [Patrón]: Value Object + Discriminator (Single Table) | [Principio]: OCP (añadir un tipo = añadir un valor + su esquema) | [Paradigma]: Declarativo

// `export enum` (TS): discriminador del contenido JSONB; cada valor tiene un esquema de validación propio
export enum CurriculumItemKind {
  GRAMMAR_RULE = 'grammar_rule', // Regla gramatical con explicación y ejemplos
  VOCABULARY = 'vocabulary', // Entrada léxica: lema, traducción, IPA opcional
  EXAMPLE = 'example', // Frase de ejemplo con traducción
  TRANSLATION = 'translation', // Traducción verificada origen → español
  PRONUNCIATION = 'pronunciation', // Transcripción IPA con variante dialectal y fuente
  COMMON_ERROR = 'common_error', // Error frecuente: incorrecto → correcto + explicación
  EXERCISE = 'exercise', // Ejercicio con clave de respuesta (corrección determinista)
  RUBRIC = 'rubric', // Rúbrica de evaluación con criterios y bandas
}

// [Etiquetas ES]: tabla inmutable para UI y logs | [Patrón]: Lookup Table
export const CURRICULUM_ITEM_KIND_LABEL_ES: Readonly<
  Record<CurriculumItemKind, string>
> = Object.freeze({
  [CurriculumItemKind.GRAMMAR_RULE]: 'Regla gramatical',
  [CurriculumItemKind.VOCABULARY]: 'Vocabulario',
  [CurriculumItemKind.EXAMPLE]: 'Ejemplo',
  [CurriculumItemKind.TRANSLATION]: 'Traducción',
  [CurriculumItemKind.PRONUNCIATION]: 'Pronunciación (IPA)',
  [CurriculumItemKind.COMMON_ERROR]: 'Error frecuente',
  [CurriculumItemKind.EXERCISE]: 'Ejercicio',
  [CurriculumItemKind.RUBRIC]: 'Rúbrica',
});
