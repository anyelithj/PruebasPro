// [Modelo Dictation · Dominio · Lectura → Dictado · 2026-11-16]: compara la frase dictada con lo que escribió el alumno, palabra por palabra
// [Algoritmo]: LCS (subsecuencia común más larga) sobre palabras normalizadas → aciertos, palabras mal escritas, que faltan y que sobran
// Mayúsculas y signos de puntuación NO cuentan como error de dictado (los señala el corrector en su feedback) | [Paradigma]: Funcional (puro, sin Angular)
// ponytail: LCS O(n·m) — frases de lectura (< 60 palabras) → instantáneo

export type DiffKind = 'ok' | 'wrong' | 'missing' | 'extra';
export interface DiffToken {
  kind: DiffKind;
  text: string; // Palabra tal cual (la escrita; en «missing», la esperada)
  expected?: string; // En «wrong»: la palabra correcta
}

const words = (s: string): string[] => s.trim().split(/\s+/).filter(Boolean);
// `\p{L}\p{N}` (Unicode): letras y números de cualquier alfabeto (ruso, chino…) · `normalize('NFC')`: «é» compuesta = «é» precompuesta
const norm = (w: string): string => w.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}'’]/gu, '').replace(/’/g, "'");

// [diffWords]: tabla LCS + recorrido; un «falta» seguido de un «sobra» se fusiona en «mal escrita» (expected → escrita)
export function diffWords(expected: string, typed: string): DiffToken[] {
  const a = words(expected).filter((w) => norm(w));
  const b = words(typed).filter((w) => norm(w));
  const na = a.map(norm);
  const nb = b.map(norm);
  // `Array.from({ length }, fn)` (ES2015): matriz (n+1)×(m+1) de ceros
  const L = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) L[i]![j] = na[i] === nb[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const raw: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && na[i] === nb[j]) {
      raw.push({ kind: 'ok', text: b[j++]! });
      i++;
    } else if (j < b.length && (i >= a.length || L[i]![j + 1]! >= L[i + 1]![j]!)) raw.push({ kind: 'extra', text: b[j++]! });
    else raw.push({ kind: 'missing', text: a[i++]! });
  }
  // [Fusión]: «sobra X» + «falta Y» (o al revés) contiguos = escribió X en vez de Y
  const out: DiffToken[] = [];
  for (const t of raw) {
    const prev = out.at(-1);
    if (prev && ((prev.kind === 'missing' && t.kind === 'extra') || (prev.kind === 'extra' && t.kind === 'missing'))) {
      const typedWord = prev.kind === 'extra' ? prev.text : t.text;
      const expectedWord = prev.kind === 'missing' ? prev.text : t.text;
      out[out.length - 1] = { kind: 'wrong', text: typedWord, expected: expectedWord };
    } else out.push(t);
  }
  return out;
}

// [dictationScore]: % de palabras esperadas escritas bien (las que sobran restan) · 0–100
export function dictationScore(tokens: readonly DiffToken[]): number {
  const expected = tokens.filter((t) => t.kind !== 'extra').length;
  if (!expected) return 0;
  const ok = tokens.filter((t) => t.kind === 'ok').length;
  const extra = tokens.filter((t) => t.kind === 'extra').length;
  return Math.max(0, Math.round(((ok - extra * 0.5) / expected) * 100));
}
