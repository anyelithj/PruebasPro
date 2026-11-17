// [clausesOf · Dominio · Libros · 2026-11-16]: parte una frase larga en renglones cortos (cláusulas) para mostrar la IPA renglón a renglón
// en vez de un bloque por frase | [Paradigma]: Funcional (función pura, sin E/S) | [Principio]: SRP
// Regla: corta DESPUÉS de , ; : — (si el trozo ya tiene ≥ MIN_PUNCT palabras) y ANTES de un conector («which», «que», «weil»…) si ya tiene ≥ MIN_CONNECTOR
// + renglones > 16 palabras se parten cerca de la mitad (splitLong)
// ponytail: heurística por palabras clave, no análisis sintáctico; basta para leer con la IPA alineada

const MIN_PUNCT = 4;
const MIN_CONNECTOR = 8;
// Conectores y relativos de los 7 idiomas de la plataforma (en minúsculas) · `Set` (ES2015): búsqueda O(1)
const CONNECTORS = new Set([
  // en
  'which',
  'who',
  'whom',
  'whose',
  'where',
  'when',
  'while',
  'because',
  'although',
  'though',
  'but',
  'and',
  'or',
  'that',
  'if',
  'until',
  // es / pt / it / fr
  'que',
  'cual',
  'cuando',
  'donde',
  'porque',
  'aunque',
  'pero',
  'mientras',
  'quando',
  'onde',
  'mas',
  'che',
  'perché',
  'ma',
  'qui',
  'quand',
  'où',
  'mais',
  'parce',
  // de
  'weil',
  'aber',
  'dass',
  'wenn',
  'als',
  'obwohl',
  'und',
  // ru
  'который',
  'которая',
  'которое',
  'которые',
  'когда',
  'потому',
  'но',
  'что',
  'и',
]);

export function clausesOf(sentence: string): string[] {
  const words = sentence.trim().split(/\s+/).filter(Boolean);
  const out: string[][] = [[]];
  for (const w of words) {
    const cur = out[out.length - 1];
    // `\p{L}` (Unicode, flag u): letras de cualquier alfabeto → «Which,» y «(which» cuentan como «which»
    const bare = w.toLowerCase().replace(/[^\p{L}]/gu, '');
    if (cur.length >= MIN_CONNECTOR && CONNECTORS.has(bare)) out.push([w]);
    else cur.push(w);
    if (/[,;:—–]$/.test(w) && out[out.length - 1].length >= MIN_PUNCT)
      out.push([]);
  }
  return out
    .filter((c) => c.length)
    .flatMap(splitLong)
    .map((c) => c.join(' '));
}

// [splitLong · 2026-11-17]: renglón de más de MAX_WORDS palabras sin coma ni conector a tiempo («…observations that require only this voyage to render…»)
// → se corta ANTES del conector o preposición más cercano a la mitad (≥ MIN_SIDE palabras a cada lado); sin ninguno, por la mitad · recursivo
const MAX_WORDS = 16;
const MIN_SIDE = 4;
const BREAKS = new Set([
  ...CONNECTORS,
  // preposiciones / infinitivo que suelen abrir un sintagma
  'to',
  'for',
  'with',
  'by',
  'from',
  'into',
  'without',
  'before',
  'after',
  'para',
  'con',
  'por',
  'sin',
  'pour',
  'avec',
  'sans',
  'für',
  'mit',
  'ohne',
  'per',
  'con',
  'для',
  'с',
  'без',
]);
function splitLong(words: string[]): string[][] {
  if (words.length <= MAX_WORDS) return [words];
  const mid = words.length / 2;
  let at = -1;
  for (let i = MIN_SIDE; i <= words.length - MIN_SIDE; i++) {
    const bare = words[i].toLowerCase().replace(/[^\p{L}]/gu, '');
    if (BREAKS.has(bare) && (at < 0 || Math.abs(i - mid) < Math.abs(at - mid)))
      at = i;
  }
  if (at < 0) at = Math.round(mid);
  return [...splitLong(words.slice(0, at)), ...splitLong(words.slice(at))];
}
