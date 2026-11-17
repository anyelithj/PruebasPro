// [text-highlight · 2026-11-16 · Marcadores de lectura en el temario]: localiza en el DOM ya pintado (Markdown) la frase que suena y su palabra
// → `Range` para la API nativa CSS Custom Highlight (`CSS.highlights` + `::highlight()`), sin tocar el HTML ni añadir librerías
// [Técnica]: se comparan solo letras y dígitos en minúsculas (el Markdown pintado ya no tiene `**`, `#`, viñetas…) y se guarda, por cada carácter
// conservado, su nodo de texto y posición → el `Range` cae exacto aunque la frase cruce negritas o enlaces | [Paradigma]: Funcional (sin estado global)

const KEEP = /[\p{L}\p{N}]/u;

export interface TextIndex {
  norm: string; // Letras y dígitos del contenedor, en minúsculas
  map: Array<{ node: Text; offset: number }>; // norm[i] → nodo y posición original
}

// [normalize]: texto → solo letras/dígitos en minúsculas + posición original de cada uno | Función pura
export function normalize(text: string): { norm: string; pos: number[] } {
  let norm = "";
  const pos: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (!KEEP.test(ch)) continue;
    norm += ch.toLowerCase();
    pos.push(i);
  }
  return { norm, pos };
}

// [indexText]: recorre los nodos de texto del contenedor (TreeWalker, DOM nativo)
export function indexText(root: Node): TextIndex {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let norm = "";
  const map: TextIndex["map"] = [];
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const { norm: part, pos } = normalize(n.data);
    norm += part;
    pos.forEach((offset) => map.push({ node: n!, offset }));
  }
  return { norm, map };
}

// [locate]: frase (y palabra [inicio, fin) relativa a la frase) → posiciones en `norm` | busca desde `from` (las frases van en orden) y, si no, desde el principio | Función pura
export function locate(norm: string, sentence: string, word: [number, number] | null, from = 0): { start: number; end: number; word: [number, number] | null } | null {
  const s = normalize(sentence);
  if (!s.norm) return null;
  let start = norm.indexOf(s.norm, from);
  if (start < 0) start = norm.indexOf(s.norm);
  if (start < 0) return null;
  let w: [number, number] | null = null;
  if (word) {
    // Caracteres conservados de la frase antes del inicio y del fin de la palabra
    const a = s.pos.findIndex((p) => p >= word[0]);
    const b = s.pos.findIndex((p) => p >= word[1]);
    if (a >= 0) w = [start + a, start + (b < 0 ? s.norm.length : b)];
  }
  return { start, end: start + s.norm.length, word: w };
}

// [rangeOf]: posiciones de `norm` → Range del DOM (fin exclusivo)
export function rangeOf(index: TextIndex, start: number, end: number): Range | null {
  const a = index.map[start];
  const b = index.map[end - 1];
  if (!a || !b || end <= start) return null;
  const r = document.createRange();
  r.setStart(a.node, a.offset);
  r.setEnd(b.node, b.offset + 1);
  return r;
}
