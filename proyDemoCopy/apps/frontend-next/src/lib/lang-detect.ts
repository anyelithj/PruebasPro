// [lang-detect · 2026-10-28]: detección LIGERA del idioma de un trozo de texto (sin red ni modelos) → la lectura en voz alta solo pronuncia el idioma del curso
// Caso real: PDFs de curso con explicaciones en español mezcladas con el inglés/francés… («farm – granja», «Ejemplo: I am a student») → antes la voz inglesa leía también el español
// [Técnica]: 1) alfabeto (Unicode Script: Han → zh, Cirílico → ru) · 2) puntuación/letras exclusivas (¿ ¡ ñ → es, ß → de, ç œ → fr, ã õ → pt) · 3) palabras funcionales frecuentes (stopwords) por idioma
// [Patrón]: Strategy (señales puntuadas) + Pure Functions | [Principio]: SRP + KISS (heurística explicable; no pretende ser un detector general) | [Paradigma]: Funcional (se prueba con Jest)

// [Stopwords]: palabras muy frecuentes y poco ambiguas por idioma | `Readonly<Record<…>>` (TS) + `Set` (ES2015) → búsqueda O(1)
const STOPWORDS: Readonly<Record<string, ReadonlySet<string>>> = {
  en: new Set("the a an and or of to in on at is are was were be been am i you he she it we they this that these those with for from by not do does did have has had my your his her our their what which who where when how there here can will would should could hello hi yes also into too go so no two".split(" ")),
  es: new Set("el la los las un una unos unas y o de del al en es son está están era fue ser estar yo tú él ella nosotros ellos usted este esta estos estas ese esa con para por que qué cómo cuál cuando dónde no sí se su sus mi mis muy pero también como hay ejemplo significa palabra palabras frase verbo soy eres somos estoy estás tengo tienes tiene hola gracias adiós porque pues donde aquí allí ahora siempre nunca todo todos cada otro otra hacer tener decir".split(" ")),
  fr: new Set("le la les un une des et ou de du au aux en est sont était être je tu il elle nous vous ils elles ce cette ces avec pour par que qui quoi ne pas oui mon ma mes son sa ses très mais aussi comme il y a dans sur".split(" ")),
  de: new Set("der die das den dem des ein eine einen und oder von zu im in ist sind war sein ich du er sie es wir ihr mit für auf nicht ja mein meine sehr aber auch wie was wer wo wann".split(" ")),
  pt: new Set("o a os as um uma uns umas e ou de do da dos das no na em é são era ser estar eu tu ele ela nós eles com para por que não sim seu sua muito mas também como você isso isto".split(" ")),
};

// [Pistas de caracteres]: letras/signos casi exclusivos de un idioma (peso alto) | `RegExp` con flag `u` (Unicode)
const CHAR_HINTS: ReadonlyArray<[lang: string, re: RegExp, weight: number]> = [
  ["es", /[¿¡ñ]/giu, 3],
  ["es", /[áíóú]/giu, 1], // Acentos agudos: frecuentes en español, raros en inglés/alemán
  ["es", /\b\p{L}+ción\b/giu, 2], // «-ción»
  ["fr", /[çœèêàâîôû]/giu, 2],
  ["fr", /\b(?:l|d|qu|n|j|c|s)['’]\p{L}/giu, 2], // Elisión: l'école, qu'il, j'ai
  ["de", /[ßäöü]/giu, 3],
  ["pt", /[ãõ]/giu, 3],
  ["pt", /\b\p{L}+ção\b/giu, 2],
];

// [Alfabetos]: `\p{Script=…}` (ES2018 Unicode property escapes)
const HAN = /\p{Script=Han}/u;
const CYRILLIC = /\p{Script=Cyrillic}/u;
const LATIN = /\p{Script=Latin}/u;
const NON_LATIN: ReadonlySet<string> = new Set(["zh", "ru"]); // Idiomas del catálogo con alfabeto propio

// [scoreLanguages]: puntuación por idioma candidato | Map (ES2015) idioma → puntos
function scoreLanguages(text: string, candidates: ReadonlyArray<string>): Map<string, number> {
  const scores = new Map(candidates.map((c) => [c, 0]));
  const words = text.toLowerCase().match(/\p{L}+(?:['’]\p{L}+)?/gu) ?? []; // Palabras Unicode (con apóstrofo interno: don't, l'eau)
  for (const w of words) for (const c of candidates) if (STOPWORDS[c]?.has(w)) scores.set(c, scores.get(c)! + 1);
  for (const [lang, re, weight] of CHAR_HINTS) {
    if (!scores.has(lang)) continue;
    const hits = text.match(re)?.length ?? 0;
    if (hits) scores.set(lang, scores.get(lang)! + hits * weight);
  }
  // [Terminación -a/-o]: pista DÉBIL de español para palabras sueltas («granja», «perro») — solo si el portugués no compite (comparte esas terminaciones)
  if (scores.has("es") && !scores.has("pt")) {
    const hits = words.filter((w) => w.length >= 4 && /[ao]s?$/u.test(w) && !STOPWORDS.en!.has(w)).length;
    if (hits) scores.set("es", scores.get("es")! + hits * 0.5);
  }
  return scores;
}

export const UNDETERMINED = "und";

// [detectLanguage]: idioma más probable entre `candidates`, o `null` si no hay señal suficiente (palabra suelta, número, nombre propio)
export function detectLanguage(text: string, candidates: ReadonlyArray<string>): string | null {
  const base = candidates.map((c) => c.toLowerCase().split("-")[0]!);
  // 1) Alfabeto: decisivo para chino y ruso (y descarta los latinos)
  // `UNDETERMINED` («und», BCP 47): alfabeto que no es de ningún candidato → seguro que NO es el idioma del curso
  if (HAN.test(text)) return base.includes("zh") ? "zh" : UNDETERMINED;
  if (CYRILLIC.test(text)) return base.includes("ru") ? "ru" : UNDETERMINED;
  if (!LATIN.test(text)) return null; // Solo números/símbolos
  const latin = base.filter((c) => c !== "zh" && c !== "ru");
  // Curso de chino/ruso + trozo en alfabeto latino → no es el idioma del curso (p. ej. la explicación en español)
  if (!latin.length) return UNDETERMINED;
  const ranked = [...scoreLanguages(text, latin)].sort((a, b) => b[1] - a[1]); // `[...map]` → pares [idioma, puntos]
  const [best, second] = ranked;
  if (!best || best[1] === 0 || (second && best[1] === second[1])) return null; // Empate o sin señal → indeciso
  return best[0];
}

// ───────── [Segmentos de una frase] ─────────
// Una frase de un PDF de curso suele mezclar idiomas separados por guiones, dos puntos, paréntesis o barras: «farm – granja», «(significa: casa)»
export interface LangChunk {
  start: number; // Índice de inicio dentro de la frase
  end: number; // Fin exclusivo
  lang: string; // Idioma detectado (indeciso → idioma del curso)
  speak: boolean; // true = idioma del curso → se pronuncia y se colorea
}

// Separadores entre idiomas: guiones largos/medios con espacios, « - », dos puntos, igual, barra, punto y coma, paréntesis/corchetes, flechas, viñetas
// [2026-10-30]: + comillas → «Se dice "I can dance" para…» separa la frase del curso de la explicación en español
const CHUNK_SEPARATOR = /\s[–—-]\s|[:=/;|•→()[\]«»“”"]/gu;

// [splitByLanguage]: frase → trozos con su idioma; solo los del idioma del curso llevan `speak: true`
// [Regla de indecisos]: un trozo SIN señal clara (palabra suelta, nombre propio) cuenta como idioma del curso → solo se omite lo que se reconoce como OTRO idioma
// (la frase completa decide primero si el trozo es la frase entera) | `others`: idiomas a descartar (por defecto el español de las explicaciones)
export function splitByLanguage(sentence: string, courseLang: string, others: ReadonlyArray<string> = ["es"]): LangChunk[] {
  const lang = courseLang.toLowerCase().split("-")[0]!;
  const candidates = [lang, ...others.filter((o) => o !== lang)];
  // Curso de chino/ruso: el alfabeto decide → un trozo latino indeciso NO es del curso (es la explicación) | `Set.has` (ES2015)
  const undecided = NON_LATIN.has(lang) ? UNDETERMINED : lang;
  const bounds: Array<[number, number]> = [];
  let from = 0;
  // `matchAll` (ES2020): recorre los separadores → los trozos conservan sus índices (el resaltado de palabra los necesita)
  for (const m of sentence.matchAll(CHUNK_SEPARATOR)) {
    const end = m.index! + m[0].length;
    bounds.push([from, end]);
    from = end;
  }
  if (from < sentence.length) bounds.push([from, sentence.length]);
  return bounds.map(([start, end]) => {
    const text = sentence.slice(start, end);
    const detected = detectLanguage(text, candidates) ?? undecided; // Indeciso → idioma del curso (si es de alfabeto latino)
    return { start, end, lang: detected, speak: detected === lang && /\p{L}/u.test(text) };
  });
}

// ───────── [Palabras del curso dentro de la explicación · 2026-11-16] ─────────
// Caso real: «Usamos always para hábitos» → el trozo es español, pero «always» es inglés y debe verse azul y leerse con voz inglesa
// [Señales]: 1) `vocab` = palabras que el MISMO texto ya usa en trozos del idioma del curso (los ejemplos de la ficha) · 2) solo inglés: grafías que el español no usa
// ponytail: heurística sin diccionario; si falla una palabra suelta, basta con que aparezca en un ejemplo de la ficha
const NOT_SPANISH_SPELLING = /th|sh|ck|wh|ph|oo|ee|w|k|ght|ing$|ly$|[^aeiou]y$|y[^aeiou\s]/u;
const isCourseWord = (w: string, courseLang: string, chunkLang: string, vocab: ReadonlySet<string>): boolean => {
  const lower = w.toLowerCase();
  if (STOPWORDS[chunkLang]?.has(lower)) return false; // «a», «de», «no»… se quedan en la explicación
  if (vocab.has(lower)) return true;
  return courseLang === "en" && chunkLang === "es" && lower.length > 2 && !/[áéíóúñü]/u.test(lower) && NOT_SPANISH_SPELLING.test(lower);
};

// [markCourseWords]: parte los trozos de OTRO idioma donde aparecen palabras del curso → esas palabras pasan a `speak: true` (color y voz del curso)
// Solo para idiomas de alfabeto latino (en chino/ruso ya decide el alfabeto) | [Paradigma]: Funcional (pura; mismos índices que la frase)
export function markCourseWords(sentence: string, chunks: readonly LangChunk[], courseLang: string, vocab: ReadonlySet<string>): LangChunk[] {
  const lang = courseLang.toLowerCase().split("-")[0]!;
  if (NON_LATIN.has(lang)) return [...chunks];
  return chunks.flatMap((c) => {
    if (c.speak || c.lang === lang) return [c];
    const out: LangChunk[] = [];
    let at = c.start;
    // `matchAll` (ES2020) sobre el trozo: cada palabra con su índice → los sub-trozos conservan las posiciones del resaltado
    for (const m of sentence.slice(c.start, c.end).matchAll(/\p{L}+(?:['’]\p{L}+)*/gu)) {
      if (!isCourseWord(m[0], lang, c.lang, vocab)) continue;
      const s = c.start + m.index!;
      const e = s + m[0].length;
      const prev = out.at(-1);
      // Palabra del curso pegada a la anterior (solo espacios/comas entre medias) → se une al mismo sub-trozo
      if (prev?.speak && /^[\s,]*$/u.test(sentence.slice(prev.end, s))) prev.end = e;
      else {
        if (s > at) out.push({ start: at, end: s, lang: c.lang, speak: false });
        out.push({ start: s, end: e, lang, speak: true });
      }
      at = e;
    }
    if (!out.length) return [c];
    if (at < c.end) out.push({ start: at, end: c.end, lang: c.lang, speak: false });
    return out;
  });
}

// [courseVocab]: palabras (minúsculas) de los trozos que se RECONOCEN como idioma del curso (no los indecisos: «granja» suelta no entra) | `Set` → O(1)
export function courseVocab(texts: ReadonlyArray<string>, courseLang: string, others: ReadonlyArray<string>): Set<string> {
  const lang = courseLang.toLowerCase().split("-")[0]!;
  const sure = texts.filter((t) => detectLanguage(t, [lang, ...others]) === lang);
  return new Set(sure.flatMap((t) => t.toLowerCase().match(/\p{L}+(?:['’]\p{L}+)*/gu) ?? []).filter((w) => w.length > 1 && !others.some((o) => STOPWORDS[o]?.has(w))));
}
