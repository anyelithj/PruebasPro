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

// [MARKERS · 2026-10-27]: palabras funcionales casi exclusivas de cada idioma latino (espejo de ai-service/src/shared/domain/language_detect.py) | `ReadonlyMap` (TS): tabla inmutable
// [Por qué aquí y no una llamada HTTP al ai-service]: el borrador ya tarda segundos en Ollama → una heurística local (< 1 ms) sin red ni acoplamiento | [Principio]: determinístico primero + DRY con la versión Python
const MARKERS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['en', new Set('the and is are was were you your my it this that with of to in for on do does what how why have has they we he she be will would can not but at from by his her their there'.split(' '))],
  ['es', new Set('el los las que es está por para con una unos pero muy también como cómo qué del al yo tú ellos nosotros tiene hay son estoy soy su sus'.split(' '))],
  ['fr', new Set('le les est et je tu vous nous il elle une des du au aux pas ce qui que mais très avec pour sur sont dans leur'.split(' '))],
  ['de', new Set('der die das und ist ich du sie wir nicht ein eine mit für auf auch sehr bin sind haben den dem zu im'.split(' '))],
  ['pt', new Set('o os um uma é não você eu com para por muito também mas está são tem do da dos das pela pelo isso ele ela'.split(' '))],
]);
// [Letras delatoras]: «ñ ¿ ¡» español · «ã õ» portugués · «ß ä ö ü» alemán · «è ê à ù û œ» francés → valen 2 puntos
const LETTERS: ReadonlyMap<string, RegExp> = new Map([
  ['es', /[ñ¿¡]/g],
  ['pt', /[ãõ]/g],
  ['de', /[ßäöü]/g],
  ['fr', /[èêàùûœëïîâ]/g],
]);

export interface LanguageGuess {
  language: string; // Código ISO 639-1 (uno de los 7 de la plataforma)
  confident: boolean; // false = poca evidencia → no se debe reintentar por esto (evita latencia de más)
}

// [detectLanguage · 2026-10-27]: escritura (CJK/cirílico) → marcadores + letras | null = texto demasiado corto | [Patrón]: Chain of Responsibility | Función pura
export function detectLanguage(text: string): LanguageGuess | null {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  if (letters < 12) return null;
  // `\p{Script=…}` (Unicode, bandera `u`): el alfabeto basta para chino y ruso
  const han = text.match(/\p{Script=Han}/gu)?.length ?? 0;
  const cyr = text.match(/\p{Script=Cyrillic}/gu)?.length ?? 0;
  if (han / letters > 0.3) return { language: 'zh', confident: true };
  if (cyr / letters > 0.3) return { language: 'ru', confident: true };
  const lower = text.toLowerCase();
  const words = lower.match(/\p{L}+/gu) ?? [];
  const scores = [...MARKERS].map(([lang, vocab]) => ({
    lang,
    score: words.filter((w) => vocab.has(w)).length + 2 * (lower.match(LETTERS.get(lang) ?? /$^/g)?.length ?? 0),
  }));
  scores.sort((a, b) => b.score - a.score);
  const [best, second] = scores;
  if (!best || best.score === 0) return null;
  // [Confianza]: ≥ 3 puntos y el doble que el segundo (es/pt comparten «que», «para», «com»…)
  return { language: best.lang, confident: best.score >= 3 && best.score >= 2 * (second?.score ?? 0) };
}

// [wrongLanguage · 2026-10-27]: idioma detectado CON confianza y distinto del meta → nombre del idioma encontrado; si no, null | Función pura
export function wrongLanguage(text: string, language: string): string | null {
  const guess = detectLanguage(text);
  if (!guess?.confident || guess.language === language) return null;
  return guess.language;
}

// [strictLine]: primera línea del prompt en el reintento | `found` (opcional): idioma en el que salió la respuesta anterior (por defecto español, el caso más frecuente)
export const strictLine = (language: string, found = 'es'): string => {
  const name = LANGUAGE_NAME_EN[language as Language] ?? language;
  const wrong = LANGUAGE_NAME_EN[found as Language] ?? found;
  return `IMPORTANT: a previous answer was written in ${wrong}, which is WRONG. Translate the topic and write ALL the learner content ENTIRELY in ${name} only.`;
};

// [inTargetLanguage · 2026-10-27]: ejecuta `run(false)`; si `sample` del resultado está (con confianza) en OTRO idioma que el meta → `run(true)` (con strictLine) UNA vez
// [2026-10-27]: antes solo detectaba español → ahora cualquiera de los 7 (p. ej. francés cuando se pidió portugués) | [Patrón]: Guard + Retry
export async function inTargetLanguage<T>(
  language: string,
  run: (strict: boolean) => Promise<T>,
  sample: (r: T) => string,
): Promise<T> {
  const first = await run(false);
  const text = sample(first);
  const spanish = language !== 'es' && looksSpanish(text);
  if (!spanish && !wrongLanguage(text, language)) return first;
  return run(true);
}
