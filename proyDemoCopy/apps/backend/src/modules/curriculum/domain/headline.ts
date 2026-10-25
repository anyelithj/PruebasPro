import { slugify } from './slug';
// [Titular de un contenido]: el texto principal que identifica un elemento (palabra, frase, título…) en cualquier tipo de recurso | [Patrón]: Specification (campo canónico por tipo) | [Principio]: DRY (lo usan la IA, la jerarquía de cursos y la comparación de fuentes) | [Paradigma]: Funcional (funciones puras)

// [headlineText]: primer campo de texto principal presente | `find` + type guard `v is string` (TS)
export const headlineText = (c: Record<string, unknown>): string =>
  [c.lemma, c.text, c.title, c.source, c.incorrect, c.prompt].find(
    (v): v is string => typeof v === 'string',
  ) ?? '';

// [textKey · 2026-10-23]: clave de comparación de un texto — slug latino; si el slug queda vacío (chino 苹果 → '') se usa el texto en minúsculas NFKC
// [Bug]: antes todo el vocabulario chino tenía la misma clave '' → la IA «solo proponía elementos que ya existen» | `String.normalize` (ES2015) | Función pura
export const textKey = (t: string): string =>
  slugify(t) || t.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();

// [headline]: versión normalizada (slug: minúsculas, sin tildes) → "Apple" y "apple" son el mismo elemento
export const headline = (c: Record<string, unknown>): string =>
  textKey(headlineText(c) || JSON.stringify(c));
