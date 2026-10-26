import { LANGUAGE_NAME_EN, type Language } from './language.vo';
// [target-language · 2026-10-25]: los modelos pequeños (qwen2.5:3b) responden en ESPAÑOL cuando el tema llega en español aunque el prompt pida inglés
// → se detecta y se repite UNA vez con una orden explícita | [Patrón]: Guard + Retry | [Principio]: DRY (práctica, diálogos y lectura) | [Paradigma]: Funcional

// Palabras muy frecuentes y propias del español (no del francés, portugués ni inglés) → pocas falsas alarmas
const SPANISH = new Set([
  'el',
  'los',
  'las',
  'y',
  'del',
  'qué',
  'cuál',
  'está',
  'una',
  'muy',
  'pero',
  'este',
  'esta',
  'estos',
  'hay',
  'también',
  'porque',
  'cuando',
  'dónde',
  'es',
  'tiene',
  'son',
]);

// [looksSpanish]: ¿el texto está (sobre todo) en español? | Función pura
export function looksSpanish(text: string): boolean {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  if (words.length < 4) return false;
  const hits =
    words.filter((w) => SPANISH.has(w)).length +
    (text.match(/[¿¡ñ]/g)?.length ?? 0);
  return hits / words.length > 0.12;
}

// [strictLine]: primera línea del prompt en el reintento
export const strictLine = (language: string): string => {
  const name = LANGUAGE_NAME_EN[language as Language] ?? language;
  return `IMPORTANT: a previous answer was written in Spanish, which is WRONG. Translate the topic and write ALL the learner content in ${name} only.`;
};

// [inTargetLanguage]: ejecuta `run(false)`; si el idioma meta no es español y `sample` del resultado parece español → `run(true)` (con strictLine)
export async function inTargetLanguage<T>(
  language: string,
  run: (strict: boolean) => Promise<T>,
  sample: (r: T) => string,
): Promise<T> {
  const first = await run(false);
  if (language === 'es' || !looksSpanish(sample(first))) return first;
  return run(true);
}
