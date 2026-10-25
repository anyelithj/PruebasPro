// spelling.util.ts (TypeScript puro) => RF-06.1 corrección ortográfica de la búsqueda ("¿Quisiste decir…?").
// Algoritmo: distancia de Levenshtein (ediciones mínimas: insertar, borrar o cambiar una letra) entre cada palabra
// buscada y el VOCABULARIO del catálogo (palabras de nombres de productos, categorías y marcas).
// Paradigma funcional: funciones puras sin estado (testeables sin base de datos). Sin dependencias: ~40 líneas.

// normalizeWord => minúsculas y sin tildes ("Camísa" -> "camisa"): una tilde olvidada no cuenta como error
export const normalizeWord = (word: string): string => word.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// tokenize => palabras de 3+ letras de un texto (las cortas como "de" o "y" no aportan a la corrección)
export const tokenize = (text: string): string[] => normalizeWord(text).match(/[\p{L}\p{N}]{3,}/gu) ?? [];

// levenshtein => programación dinámica con UNA fila (memoria O(n)); "max" corta temprano si ya se pasó del límite
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1; // Diferencia de largo imposible de cubrir
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index); // Fila 0: 0,1,2,... (insertar todo b)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      // Mínimo entre borrar (arriba), insertar (izquierda) y cambiar/igual (diagonal)
      const cost = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1));
      current.push(cost);
      rowMin = Math.min(rowMin, cost);
    }
    if (rowMin > max) return max + 1; // Toda la fila ya supera el límite: no hace falta seguir
    previous = current;
  }
  return previous[b.length] ?? max + 1;
}

// maxEdits => tolerancia según el largo de la palabra (en una de 4 letras, 2 errores la cambian por completo)
const maxEdits = (word: string): number => (word.length <= 4 ? 1 : word.length <= 8 ? 2 : 3);

// correctQuery => texto corregido palabra por palabra, o null si todas las palabras ya existen o no hay candidatas.
// "vocabulary" => Map palabra -> frecuencia: ante un empate de distancia gana la palabra más común del catálogo.
export function correctQuery(query: string, vocabulary: ReadonlyMap<string, number>): string | null {
  let changed = false;
  const words = query.trim().split(/\s+/).map((original) => {
    const word = normalizeWord(original);
    if (word.length < 3 || vocabulary.has(word)) return original; // Palabra corta o ya válida: se respeta
    let best: { word: string; distance: number; frequency: number } | null = null;
    for (const [candidate, frequency] of vocabulary) {
      const distance = levenshtein(word, candidate, maxEdits(word));
      if (distance > maxEdits(word)) continue;
      if (!best || distance < best.distance || (distance === best.distance && frequency > best.frequency)) best = { word: candidate, distance, frequency };
    }
    if (!best) return original;
    changed = true;
    return best.word;
  });
  return changed ? words.join(" ") : null;
}
