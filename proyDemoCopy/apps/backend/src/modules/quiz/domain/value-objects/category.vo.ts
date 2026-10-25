// [Value Object Category]: catálogo cerrado de competencias lingüísticas | [Patrón]: Value Object | [Principio]: SRP + ISP | [Paradigma]: POO

// [Categorías]: competencias MCER/CEFR evaluables en cualquier idioma objetivo.
// [Valores legacy]: materias escolares de la versión anterior; se conservan SOLO para que
// las filas existentes en BD sigan siendo válidas (el enum de Postgres no admite quitar valores
// en uso). No se ofrecen en la UI | [Patrón]: Backward Compatibility
export enum Category {
  GENERAL = 'general',
  GRAMMAR = 'grammar',
  VOCABULARY = 'vocabulary',
  READING = 'reading',
  LISTENING = 'listening',
  WRITING = 'writing',
  SPEAKING = 'speaking',
  PRONUNCIATION = 'pronunciation',
  CUSTOM = 'custom',
  /** @deprecated legacy — materia escolar */
  LANGUAGE = 'language',
  /** @deprecated legacy — materia escolar */
  MATH = 'math',
  /** @deprecated legacy — materia escolar */
  SCIENCE = 'science',
  /** @deprecated legacy — materia escolar */
  BIOLOGY = 'biology',
  /** @deprecated legacy — materia escolar */
  PHYSICS = 'physics',
  /** @deprecated legacy — materia escolar */
  CHEMISTRY = 'chemistry',
  /** @deprecated legacy — materia escolar */
  HISTORY = 'history',
  /** @deprecated legacy — materia escolar */
  GEOGRAPHY = 'geography',
  /** @deprecated legacy — materia escolar */
  SOCIAL_SCIENCES = 'social_sciences',
  /** @deprecated legacy — materia escolar */
  ENGLISH = 'english',
  /** @deprecated legacy — materia escolar */
  TECHNOLOGY = 'technology',
  /** @deprecated legacy — materia escolar */
  ART = 'art',
}

// [Competencias vigentes]: las únicas que la UI ofrece y el generador IA debe usar | [Principio]: SSOT
export const ACTIVE_CATEGORIES: ReadonlyArray<Category> = Object.freeze([
  Category.GENERAL,
  Category.GRAMMAR,
  Category.VOCABULARY,
  Category.READING,
  Category.LISTENING,
  Category.WRITING,
  Category.SPEAKING,
  Category.PRONUNCIATION,
  Category.CUSTOM,
]);

// [Nombre legible ES]: usado en prompts y logs | [Patrón]: Lookup Table
export const CATEGORY_LABEL_ES: Readonly<Partial<Record<Category, string>>> =
  Object.freeze({
    [Category.GENERAL]: 'General',
    [Category.GRAMMAR]: 'Gramática',
    [Category.VOCABULARY]: 'Vocabulario',
    [Category.READING]: 'Comprensión lectora',
    [Category.LISTENING]: 'Comprensión auditiva',
    [Category.WRITING]: 'Expresión escrita',
    [Category.SPEAKING]: 'Expresión oral',
    [Category.PRONUNCIATION]: 'Pronunciación',
    [Category.CUSTOM]: 'Personalizada',
  });

export function isCategory(value: string): value is Category {
  return Object.values(Category).includes(value as Category);
}
