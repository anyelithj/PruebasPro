// [Value Object ReadingGenre · Lectura · 2026-10-25]: géneros de los textos de lectura (cuento, fábula, animales, poema, noticia, diálogo, biografía, leyenda) | [Patrón]: Value Object + Lookup Table | [Principio]: SSOT (espejo de READING_GENRES de @aula/shared-schemas que usan Next.js y Angular) | [Paradigma]: Declarativo
// [Tecnología]: TypeScript puro — sin NestJS ni TypeORM (el dominio no depende del framework)

// `export enum` (TS): valores string legibles en BD, JSON y logs
export enum ReadingGenre {
  TALE = 'tale', // Cuento
  FABLE = 'fable', // Fábula (con moraleja)
  ANIMALS = 'animals', // Fauna / texto informativo sobre animales
  POEM = 'poem', // Poema (cada verso es una «frase»)
  NEWS = 'news', // Noticia
  DIALOGUE = 'dialogue', // Diálogo narrado
  BIOGRAPHY = 'biography', // Biografía
  LEGEND = 'legend', // Leyenda / mito
}

// [Etiqueta ES]: `Readonly<Record<…>>` (TS) + `Object.freeze` (JS) → tabla inmutable (PDF, TXT y títulos)
export const READING_GENRE_LABEL: Readonly<Record<ReadingGenre, string>> =
  Object.freeze({
    [ReadingGenre.TALE]: 'Cuento',
    [ReadingGenre.FABLE]: 'Fábula',
    [ReadingGenre.ANIMALS]: 'Fauna y animales',
    [ReadingGenre.POEM]: 'Poema',
    [ReadingGenre.NEWS]: 'Noticia',
    [ReadingGenre.DIALOGUE]: 'Diálogo',
    [ReadingGenre.BIOGRAPHY]: 'Biografía',
    [ReadingGenre.LEGEND]: 'Leyenda',
  });

// [Instrucción para el LLM por género]: qué forma debe tener el texto (en inglés: los modelos pequeños siguen mejor las instrucciones en inglés) | [Patrón]: Strategy (por datos)
export const READING_GENRE_PROMPT: Readonly<Record<ReadingGenre, string>> =
  Object.freeze({
    [ReadingGenre.TALE]: 'a short story with a beginning, a problem and an ending',
    [ReadingGenre.FABLE]: 'a fable with animal characters and a final moral in one sentence',
    [ReadingGenre.ANIMALS]: 'an informative text about an animal (habitat, food, behaviour, a curious fact)',
    [ReadingGenre.POEM]: 'a simple rhyming poem; each verse on its own line, stanzas separated by a blank line',
    [ReadingGenre.NEWS]: 'a short news article (headline-style first sentence, who/what/where/when/why)',
    [ReadingGenre.DIALOGUE]: 'a narrated dialogue between two characters using quotation marks',
    [ReadingGenre.BIOGRAPHY]: 'a short biography of a real, well-known historical person (only facts you are sure about)',
    [ReadingGenre.LEGEND]: 'a traditional-style legend that explains the origin of something',
  });

// [Type guard]: `value is ReadingGenre` (TS) estrecha el tipo en el llamador
export function isReadingGenre(value: unknown): value is ReadingGenre {
  return Object.values(ReadingGenre).includes(value as ReadingGenre);
}

// [Estado de publicación]: igual que práctica, gramática y poliglota (borrador → publicado) | [Patrón]: State
export type ReadingStatus = 'draft' | 'published';
// [Origen]: trazabilidad de cómo se creó (lo de la IA se marca para revisar)
export type ReadingSource = 'ai' | 'manual' | 'import';
