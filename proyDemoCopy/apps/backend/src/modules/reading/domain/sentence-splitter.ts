// [SentenceSplitter · Lectura · 2026-10-25]: texto → párrafos → frases (determinístico, sin LLM) | [Patrón]: Pure Functions + Lookup Table (abreviaturas) | [Principio]: SRP + determinístico primero + testeable sin Nest | [Paradigma]: Funcional
// [Por qué propio y no Intl.Segmenter]: ICU parte «Mr. Smith» y «z.B. der» sin la lista de supresiones → aquí se controla por idioma y se prueba con Jest
// [Unicode]: `\p{Lu}` (mayúscula de cualquier alfabeto: latino, cirílico…) y `\p{L}` con la bandera `u` (ES2018)

export const MAX_SENTENCES = 400; // Tope por texto (= límite de la tabla del editor y del PDF)
export const MAX_SENTENCE_CHARS = 600; // Una «frase» más larga se trocea por palabras (TTS y traducción por línea)

export interface SentenceDraft {
  paragraph: number; // Índice del párrafo (0…)
  position: number; // Orden global en el texto (0…)
  text: string;
}

// [ABBREVIATIONS]: palabras con punto que NO cierran frase (en, es, fr, de, pt) | `ReadonlySet` (TS): pertenencia O(1) e inmutable
const ABBREVIATIONS: ReadonlySet<string> = new Set([
  'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'st.', 'jr.', 'sr.', 'vs.', 'etc.', 'e.g.', 'i.e.', 'no.', 'mt.', 'inc.', 'ltd.',
  'sra.', 'srta.', 'dra.', 'ud.', 'uds.', 'pág.', 'núm.', 'av.', 'aprox.',
  'm.', 'mme.', 'mlle.', 'p.ex.', 'cf.',
  'z.b.', 'bzw.', 'usw.', 'hr.', 'fr.', 'nr.', 'ca.', 'd.h.', 'u.a.',
  'sr.ª', 'dr.ª', 'v.', 'pe.',
]);

// [Fin de frase]: puntuación final + comillas/paréntesis de cierre + espacio, seguida de una mayúscula, dígito o signo de apertura (¿ ¡ « “ —) | lookahead `(?=…)` (ES2018 con `u`)
const BOUNDARY = /[.!?…]+["'»”’)\]]*\s+(?=["'«“‘(\[¿¡—–-]?[\p{Lu}\p{N}])/gu;
// [Chino]: los signos 。！？ cierran frase sin espacio después | `g`: todas las coincidencias
const CJK_SENTENCE = /[^。！？!?]+(?:[。！？!?]+[”」』"]?|$)/g;

// [isAbbreviation]: «Mr.», «z.B.» o una inicial («J.») no cierran la frase · en alemán un ordinal («am 3. Mai») tampoco
function isAbbreviation(token: string, language: string): boolean {
  const w = token.toLowerCase().replace(/^[("'«“‘¿¡]+/, '');
  if (/^\p{L}\.$/u.test(w)) return true; // Inicial de un nombre: «J. K. Rowling»
  if (language === 'de' && /^\d+\.$/.test(w)) return true;
  return ABBREVIATIONS.has(w);
}

// [chunkLong]: frase demasiado larga → trozos ≤ MAX_SENTENCE_CHARS cortando entre palabras | Función pura
export function chunkLong(sentence: string, max = MAX_SENTENCE_CHARS): string[] {
  if (sentence.length <= max) return [sentence];
  const out: string[] = [];
  let cur = '';
  for (const word of sentence.split(/\s+/)) {
    if (cur && (cur + ' ' + word).length > max) {
      out.push(cur);
      cur = word;
    } else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) out.push(cur.slice(0, max)); // Una «palabra» de más de `max` (URL larga) se corta
  return out;
}

// [splitParagraphs]: líneas en blanco separan párrafos · en prosa los saltos simples se unen; en verso (poema) se conservan | Función pura
export function splitParagraphs(text: string, verse = false): string[] {
  return text
    .replace(/\r\n?/g, '\n') // Windows/Mac clásico → \n
    .split(/\n\s*\n/) // Párrafo = bloque separado por una línea vacía
    .map((p) =>
      verse
        ? p
            .split('\n')
            .map((l) => l.replace(/[ \t]+/g, ' ').trim())
            .filter(Boolean)
            .join('\n')
        : p.replace(/\s+/g, ' ').trim(),
    )
    .filter(Boolean);
}

// [splitSentences]: un párrafo → frases | verso: cada línea es una frase (se lee y se escucha verso a verso)
export function splitSentences(paragraph: string, language: string, verse = false): string[] {
  if (verse) return paragraph.split('\n').map((l) => l.trim()).filter(Boolean).flatMap((l) => chunkLong(l));
  const text = paragraph.replace(/\s+/g, ' ').trim();
  if (!text) return [];
  if (language === 'zh') return (text.match(CJK_SENTENCE) ?? []).map((s) => s.trim()).filter(Boolean).flatMap((s) => chunkLong(s));
  const out: string[] = [];
  let start = 0;
  // `matchAll` (ES2020): iterador de coincidencias con su índice
  for (const m of text.matchAll(BOUNDARY)) {
    const idx = m.index ?? 0;
    const lastToken = text.slice(start, idx).split(' ').pop() ?? '';
    // Solo un punto simple puede ser abreviatura («?» y «!» siempre cierran)
    if (m[0].startsWith('.') && !m[0].startsWith('..') && isAbbreviation(`${lastToken}.`, language)) continue;
    out.push(text.slice(start, idx + m[0].trimEnd().length).trim());
    start = idx + m[0].length;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out.flatMap((s) => chunkLong(s));
}

// [buildSentences]: párrafos → frases numeradas (párrafo + posición global), con el tope MAX_SENTENCES | Función pura
export function buildSentences(paragraphs: readonly string[], language: string, verse = false): SentenceDraft[] {
  const out: SentenceDraft[] = [];
  paragraphs.forEach((p, paragraph) => {
    for (const text of splitSentences(p, language, verse)) {
      if (out.length >= MAX_SENTENCES) return;
      out.push({ paragraph, position: out.length, text });
    }
  });
  return out;
}

// [countWords]: palabras del texto (chino: cada carácter Han cuenta como palabra) → tiempo estimado de lectura | `\p{Script=Han}` (Unicode)
export function countWords(text: string, language: string): number {
  if (language === 'zh') return (text.match(/\p{Script=Han}/gu) ?? []).length;
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}
