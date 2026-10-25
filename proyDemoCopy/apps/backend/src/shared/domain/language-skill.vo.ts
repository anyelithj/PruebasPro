// [Value Object LanguageSkill]: competencias comunicativas del MCER usadas por curriculum (y alineadas con las Category vigentes de quiz) | [Patrón]: Value Object + Shared Kernel (DDD) | [Principio]: SSOT | [Paradigma]: Declarativo
// [Tecnología]: TypeScript puro, sin dependencias de framework

// `export enum` (TS): mismos valores string que las Category activas de quiz → los datos son intercambiables entre módulos
export enum LanguageSkill {
  GRAMMAR = 'grammar', // Gramática
  VOCABULARY = 'vocabulary', // Vocabulario / léxico
  READING = 'reading', // Comprensión lectora
  LISTENING = 'listening', // Comprensión auditiva
  WRITING = 'writing', // Expresión escrita
  SPEAKING = 'speaking', // Expresión oral
  PRONUNCIATION = 'pronunciation', // Pronunciación (IPA, audio)
}

// [Etiquetas ES]: `Readonly<Record<...>>` (TS) + `Object.freeze` (JS) → tabla inmutable | [Patrón]: Lookup Table
export const LANGUAGE_SKILL_LABEL_ES: Readonly<Record<LanguageSkill, string>> =
  Object.freeze({
    [LanguageSkill.GRAMMAR]: 'Gramática',
    [LanguageSkill.VOCABULARY]: 'Vocabulario',
    [LanguageSkill.READING]: 'Comprensión lectora',
    [LanguageSkill.LISTENING]: 'Comprensión auditiva',
    [LanguageSkill.WRITING]: 'Expresión escrita',
    [LanguageSkill.SPEAKING]: 'Expresión oral',
    [LanguageSkill.PRONUNCIATION]: 'Pronunciación',
  });
