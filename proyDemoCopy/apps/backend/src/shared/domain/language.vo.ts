// [Value Object Language]: idiomas objetivo de la plataforma (ISO 639-1) | [Patrón]: Value Object + Shared Kernel (DDD) | [Principio]: SSOT + SRP | [Paradigma]: Declarativo
// [Tecnología]: TypeScript puro — compartido por quiz, courses y curriculum sin acoplarlos entre sí

// `export enum` (TS): valores string = códigos ISO 639-1 legibles en BD, JSON y logs
export enum Language {
  EN = 'en', // Inglés
  ES = 'es', // Español
  FR = 'fr', // Francés
  DE = 'de', // Alemán
  PT = 'pt', // Portugués
  ZH = 'zh', // Chino mandarín
  RU = 'ru', // Ruso
}

// `const` (JS): enlace inmutable | [Idioma objetivo por defecto]: usado cuando un DTO no lo especifica
export const DEFAULT_LANGUAGE: Language = Language.EN;

// [Idioma de instrucción]: explicaciones, feedback y traducciones se redactan en español | [Principio]: SSOT
export const INSTRUCTION_LANGUAGE: Language = Language.ES;

// [Nombre legible ES]: `Readonly<Record<...>>` (TS) + `Object.freeze` (JS) = tabla inmutable | [Patrón]: Lookup Table
export const LANGUAGE_LABEL: Readonly<Record<Language, string>> = Object.freeze(
  {
    [Language.EN]: 'Inglés',
    [Language.ES]: 'Español',
    [Language.FR]: 'Francés',
    [Language.DE]: 'Alemán',
    [Language.PT]: 'Portugués',
    [Language.ZH]: 'Chino mandarín',
    [Language.RU]: 'Ruso',
  },
);

// [Nombre en inglés]: los prompts del LLM se escriben en inglés → "in Inglés" confunde a modelos pequeños y responden en español | [Patrón]: Lookup Table
export const LANGUAGE_NAME_EN: Readonly<Record<Language, string>> =
  Object.freeze({
    [Language.EN]: 'English',
    [Language.ES]: 'Spanish',
    [Language.FR]: 'French',
    [Language.DE]: 'German',
    [Language.PT]: 'Portuguese',
    [Language.ZH]: 'Mandarin Chinese',
    [Language.RU]: 'Russian',
  });

// [Type guard]: `value is Language` (TS) estrecha el tipo para el llamador | [Principio]: Type-Safe
export function isLanguage(value: string): value is Language {
  return Object.values(Language).includes(value as Language);
}

// [Variante regional por defecto]: la pronunciación (IPA y audio) siempre declara su variante → si no llega, se usa esta | [Principio]: SSOT (antes estaba copiada en dos archivos)
export const DEFAULT_VARIANT: Readonly<Record<Language, string>> =
  Object.freeze({
    [Language.EN]: 'en-GB',
    [Language.ES]: 'es-ES',
    [Language.FR]: 'fr-FR',
    [Language.DE]: 'de-DE',
    [Language.PT]: 'pt-BR',
    [Language.ZH]: 'zh-CN',
    [Language.RU]: 'ru-RU',
  });
