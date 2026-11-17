// [looksSpanish · 2026-11-11 · «una pregunta en español en el examen de alemán»]: enunciado u opciones escritos en español
// (las explicaciones SÍ van en español; la pregunta va en el idioma objetivo) | Función pura
// ponytail: heurística por signos y palabras que solo existen en español; un detector de idioma si se cuelan otras
const ONLY_SPANISH = new Set(['el', 'los', 'las', 'qué', 'cuál', 'cuáles', 'una', 'del', 'más', 'está', 'oración', 'verbo', 'palabra', 'correcta', 'después', 'según', 'también', 'cómo']);

export function looksSpanish(...texts: string[]): boolean {
  const all = texts.join(' ');
  if (/[¿¡ñ]/i.test(all)) return true;
  const words = all.toLowerCase().match(/\p{L}+/gu) ?? [];
  return words.filter((w) => ONLY_SPANISH.has(w)).length >= 3;
}
