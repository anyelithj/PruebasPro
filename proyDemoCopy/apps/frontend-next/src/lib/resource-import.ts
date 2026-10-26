import type { CurriculumItemKind } from "@/types/curriculum";
// [Importación de recursos]: convierte filas de texto (de Excel, Word, PDF, OCR o .txt) en contenidos por tipo de recurso, listos para revisar en el formulario
// [Patrón]: Adapter (formato libre → contenido tipado) + Lookup Table (alias de columnas) + Strategy (armado por tipo) | [Principio]: SRP + OCP (nuevo tipo = nueva entrada) | [Paradigma]: Funcional (funciones puras, sin DOM)
// [Deterministic-first]: reglas explícitas, sin IA; lo que falte lo completa el autor antes de guardar (el backend vuelve a validar)

export type Row = string[];
type Field = "term" | "translation" | "example" | "exampleTranslation" | "emoji" | "ipa" | "incorrect" | "correct" | "explanation" | "gender" | "pos" | "title" | "structure";

// [Tipos importables]: los de estructura simple (una fila = un elemento) + [2026-10-24] reglas gramaticales (documento → una regla; Excel → una regla por fila)
export const IMPORTABLE_KINDS: ReadonlySet<CurriculumItemKind> = new Set(["vocabulary", "grammar_rule", "example", "translation", "pronunciation", "common_error"]);
export const MAX_IMPORT_ROWS = 500; // Tope por archivo (formularios manejables)

// [Columnas por posición]: si el archivo no trae encabezados | `Readonly<Record<…>>` (TS)
const POSITIONAL: Readonly<Partial<Record<CurriculumItemKind, Field[]>>> = {
  vocabulary: ["term", "translation", "example", "exampleTranslation", "emoji"],
  example: ["term", "translation"],
  translation: ["term", "translation", "explanation"],
  pronunciation: ["term", "ipa"],
  common_error: ["incorrect", "correct", "explanation"],
  grammar_rule: ["title", "explanation", "structure", "example", "exampleTranslation"], // [2026-10-24]: Excel/CSV sin encabezados
};

// [Alias de encabezados]: español e inglés, sin tildes ni mayúsculas | [Patrón]: Lookup Table
const ALIASES: Readonly<Record<Field, string[]>> = {
  // [2026-10-24]: + nombres de idioma («English | Spanish», «Inglés | Español»): encabezado típico de tablas en PDF y páginas web
  term: ["palabra", "word", "vocabulario", "vocabulary", "termino", "lemma", "frase", "phrase", "sentence", "oracion", "texto", "text", "original", "source", "expresion", "expression", "ingles", "english", "frances", "french", "francais", "aleman", "german", "deutsch", "portugues", "portuguese", "ruso", "russian", "chino", "chinese"],
  translation: ["traduccion", "translation", "espanol", "spanish", "castellano", "significado", "meaning", "es"],
  example: ["ejemplo", "example"],
  exampleTranslation: ["traduccion del ejemplo", "traduccion ejemplo", "example translation"],
  emoji: ["emoji", "icono", "icon"],
  ipa: ["ipa", "pronunciacion", "pronunciation", "fonetica", "transcripcion"],
  incorrect: ["incorrecto", "incorrect", "error", "mal", "wrong"],
  correct: ["correcto", "correct", "bien", "right"],
  explanation: ["explicacion", "explanation", "nota", "notas", "notes", "note"],
  gender: ["genero", "gender"],
  pos: ["tipo", "categoria", "part of speech", "pos", "tipo de palabra"],
  title: ["regla", "titulo", "title", "rule", "nombre", "nombre de la regla", "tema"], // [2026-10-24]: reglas gramaticales
  structure: ["formula", "estructura", "structure", "pattern", "patron"],
};

// [Variante IPA por defecto]: mismo criterio que el backend (la IPA siempre lleva variante del idioma)
const DEFAULT_VARIANT: Readonly<Record<string, string>> = { en: "en-GB", es: "es-ES", fr: "fr-FR", de: "de-DE", pt: "pt-BR", zh: "zh-CN", ru: "ru-RU" };

// [norm]: minúsculas, sin tildes ni signos → compara encabezados | `normalize("NFD")` + `\p{M}` (Unicode)
const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();

// [Separadores de columnas en texto libre]: por prioridad (el primero que aparezca en la línea manda)
// [2026-10-24]: `/ {3,}/` → columnas alineadas con espacios (OCR de tablas y texto de PDF sin tabuladores)
const SEPARATORS: ReadonlyArray<RegExp> = [/\t+/, / {3,}/, /\s*\|\s*/, /\s*;\s*/, /\s*=\s*/, /\s*(?:→|->|=>)\s*/, /\s+[–—-]\s+/, /:\s+/];

// [splitLine]: quita viñetas/numeración y divide la línea en columnas | [Paradigma]: Funcional (pura)
export function splitLine(line: string): Row {
  const clean = line.replace(/^\s*(?:[-•*·▪●◦]|\d+[.)]|[a-z][.)])\s+/i, "").trim(); // "1. apple - manzana" → "apple - manzana"
  if (!clean) return [];
  const sep = SEPARATORS.find((re) => re.test(clean));
  return (sep ? clean.split(sep) : [clean]).map((c) => c.trim());
}

// [textToRows]: texto (Word, PDF, OCR, .txt) → filas | una línea = un elemento; líneas vacías se ignoran
export const textToRows = (text: string): Row[] =>
  text
    .split(/\r?\n/)
    .map(splitLine)
    .filter((r) => r.some(Boolean));

// [headerMap]: si la fila son encabezados conocidos devuelve columna → campo; si no, null
function headerMap(first: Row): Map<number, Field> | null {
  const map = new Map<number, Field>();
  first.forEach((cell, i) => {
    const n = norm(cell);
    const field = (Object.keys(ALIASES) as Field[]).find((f) => ALIASES[f].includes(n));
    if (field && ![...map.values()].includes(field)) map.set(i, field);
  });
  // Encabezado = al menos 2 columnas reconocidas (o 1 si la fila tiene una sola celda)
  return map.size >= Math.min(2, first.filter(Boolean).length) && map.size > 0 ? map : null;
}

// [findHeader · 2026-10-24]: busca la fila de encabezados entre las primeras HEADER_SCAN filas (PDF y webs suelen traer un título antes de la tabla)
// → devuelve el mapa y cuántas filas hay que saltar | [Paradigma]: Funcional (pura)
const HEADER_SCAN = 5;
function findHeader(rows: Row[]): { map: Map<number, Field>; skip: number } | null {
  for (let i = 0; i < Math.min(rows.length, HEADER_SCAN); i++) {
    const map = headerMap(rows[i]);
    if (map) return { map, skip: i + 1 }; // Las filas anteriores (títulos) se descartan
  }
  return null;
}

// [leadingEmoji]: "🍎 apple" → ["🍎", "apple"] | `\p{Extended_Pictographic}` (Unicode, ES2018)
const EMOJI = /^((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|‍(?:\p{Extended_Pictographic}))*)\s*/u;
function splitEmoji(term: string): [string | undefined, string] {
  const m = EMOJI.exec(term);
  return m ? [m[1], term.slice(m[0].length).trim()] : [undefined, term];
}

// [Detección de columnas invertidas · 2026-10-23]: «manzana - apple» en un recurso de inglés → la palabra en inglés debe ir en el campo del idioma y la española en la traducción | heurística por marcas del español (tildes, ñ, ¿¡ y palabras muy frecuentes) | [Paradigma]: Funcional (pura)
const ES_WORDS = new Set(["el", "la", "los", "las", "un", "una", "de", "del", "que", "es", "y", "en", "por", "para", "con", "no", "se", "lo", "su", "mi", "tu", "yo", "al", "como", "pero"]);
export function spanishScore(text: string): number {
  const t = text.toLowerCase();
  const marks = (t.match(/[áéíóúñü¿¡]/g) ?? []).length; // `match` con /g: todas las apariciones
  const words = t.split(/[^\p{L}]+/u).filter((w) => ES_WORDS.has(w)).length;
  return marks * 2 + words;
}

export interface ImportResult {
  contents: Record<string, unknown>[];
  skipped: number; // Filas sin texto principal o repetidas
  incomplete: number; // Elementos a los que les falta la traducción u otro campo obligatorio
}

// [rowsToContents]: filas → contenidos del tipo elegido | [Patrón]: Strategy por tipo
export function rowsToContents(kind: CurriculumItemKind, rows: Row[], language: string): ImportResult {
  const positional = POSITIONAL[kind];
  if (!positional) throw new Error("Este tipo de recurso no se puede importar desde archivo.");
  if (kind === "grammar_rule") return rowsToGrammar(rows); // [2026-10-24]: una regla por fila (con varias filas de ejemplos por regla)
  const found = findHeader(rows);
  const header = found?.map ?? null;
  let body = (found ? rows.slice(found.skip) : rows).slice(0, MAX_IMPORT_ROWS);
  // [Columnas invertidas · 2026-10-23]: sin encabezados y con idioma ≠ español, si la 1.ª columna «suena» más a español que la 2.ª → se intercambian
  if (!header && language !== "es" && (kind === "vocabulary" || kind === "example" || kind === "translation")) {
    const [a, b] = body.reduce(([x, y], r) => [x + spanishScore(r[0] ?? ""), y + spanishScore(r[1] ?? "")], [0, 0]); // `reduce` (ES5): suma de puntajes por columna
    if (a > b && a >= 2) body = body.map((r) => [r[1] ?? "", r[0] ?? "", ...r.slice(2)]);
  }
  const seen = new Set<string>(); // [Sin duplicados]: `Set` (ES2015) por texto normalizado
  const contents: Record<string, unknown>[] = [];
  let skipped = 0;
  let incomplete = 0;

  for (const row of body) {
    // Registro campo → valor por encabezado o por posición
    const rec: Partial<Record<Field, string>> = {};
    row.forEach((cell, i) => {
      const field = header ? header.get(i) : positional[i];
      if (field && cell.trim()) rec[field] = cell.trim();
    });
    const main = rec.term ?? rec.incorrect ?? "";
    const [emoji, term] = splitEmoji(main);
    const dedupe = norm(term);
    // [Ruido de páginas web/PDF]: en vocabulario y pronunciación, una línea suelta de más de 4 palabras es texto de introducción, no una palabra
    const looseSentence = (kind === "vocabulary" || kind === "pronunciation") && row.filter(Boolean).length === 1 && term.split(/\s+/).length > 4;
    if (!dedupe || seen.has(dedupe) || looseSentence) {
      skipped += 1;
      continue;
    }
    seen.add(dedupe);
    const variant = DEFAULT_VARIANT[language] ?? language;
    let content: Record<string, unknown>;
    switch (kind) {
      case "vocabulary":
        content = {
          lemma: term,
          translationEs: rec.translation ?? "",
          ...(rec.emoji || emoji ? { emoji: rec.emoji ?? emoji } : {}),
          ...(rec.gender ? { gender: rec.gender } : {}),
          ...(rec.pos ? { partOfSpeech: rec.pos.toLowerCase() } : {}),
          ...(rec.ipa ? { ipa: { value: rec.ipa, variant } } : {}),
          examples: rec.example ? [{ text: rec.example, translationEs: rec.exampleTranslation ?? "" }] : [],
        };
        break;
      case "example":
        content = { text: term, translationEs: rec.translation ?? "" };
        break;
      case "translation":
        content = { source: term, targetEs: rec.translation ?? "", ...(rec.explanation ? { notes: rec.explanation } : {}) };
        break;
      case "pronunciation":
        content = { text: term, ipa: { value: rec.ipa ?? "", variant } };
        break;
      default: // common_error
        content = { incorrect: term, correct: rec.correct ?? "", explanationEs: rec.explanation ?? "" };
    }
    // [Incompleto]: falta la segunda columna obligatoria del tipo → el autor la completa en el formulario
    const second = kind === "pronunciation" ? rec.ipa : kind === "common_error" ? rec.correct : rec.translation;
    if (!second) incomplete += 1;
    contents.push(content);
  }
  return { contents, skipped, incomplete };
}

// [templateCsv]: plantilla descargable con encabezados y una fila de ejemplo por tipo | BOM UTF-8 → Excel respeta las tildes
const TEMPLATES: Readonly<Partial<Record<CurriculumItemKind, string[][]>>> = {
  vocabulary: [["palabra", "traduccion", "ejemplo", "traduccion del ejemplo", "emoji"], ["apple", "manzana", "I eat an apple every day.", "Como una manzana cada día.", "🍎"]],
  example: [["frase", "traduccion"], ["What time is it?", "¿Qué hora es?"]],
  translation: [["texto", "traduccion", "notas"], ["See you later!", "¡Hasta luego!", "Despedida informal"]],
  pronunciation: [["palabra", "ipa"], ["water", "/ˈwɔːtə/"]],
  common_error: [["incorrecto", "correcto", "explicacion"], ["I have 20 years.", "I am 20 years old.", "La edad se expresa con el verbo to be."]],
  // [2026-10-24]: una fila por regla; filas extra con el nombre vacío añaden más ejemplos a la regla anterior
  grammar_rule: [["regla", "explicacion", "formula", "ejemplo", "traduccion del ejemplo"], ["Present perfect", "Acciones pasadas con relevancia en el presente.", "have/has + participio", "I have lost my keys.", "He perdido mis llaves."], ["", "", "", "She has visited Paris twice.", "Ella ha visitado París dos veces."]],
};
// [templateRows · 2026-10-23]: filas de la plantilla (las usa la plantilla Excel .xlsx) | `undefined` si el tipo no se importa
export const templateRows = (kind: CurriculumItemKind): string[][] | undefined => TEMPLATES[kind];

export function templateCsv(kind: CurriculumItemKind): string | null {
  const t = TEMPLATES[kind];
  // Comillas dobles escapadas (RFC 4180) | `﻿`: BOM para que Excel detecte UTF-8
  return t ? "﻿" + t.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\r\n") : null;
}

// ───── [2026-10-24] Reglas gramaticales + fuente común de importación ─────

type Example = { text: string; translationEs: string }; // Ejemplo con traducción (misma forma que exampleSchema del backend)
const MAX_EXAMPLES = 20; // = examples.max(20) del esquema de reglas en NestJS

// [rowsToGrammar]: tabla (Excel/CSV/tabla de Word o web) → una regla por fila | filas sin nombre de regla añaden ejemplos a la regla anterior
// [Patrón]: Adapter + Accumulator | [Paradigma]: Funcional (sin efectos fuera de la función)
function rowsToGrammar(rows: Row[]): ImportResult {
  const found = findHeader(rows);
  const fields = (row: Row): Partial<Record<Field, string>> => {
    const rec: Partial<Record<Field, string>> = {};
    row.forEach((cell, i) => {
      const f = found ? found.map.get(i) : POSITIONAL.grammar_rule![i]; // `!` (TS): la entrada existe (definida arriba)
      // «traduccion» suelta en una tabla de reglas = traducción del ejemplo
      const field = f === "translation" ? "exampleTranslation" : f;
      if (field && cell.trim()) rec[field] = cell.trim();
    });
    return rec;
  };
  const contents: Array<Record<string, unknown> & { examples: Example[] }> = [];
  let skipped = 0;
  for (const row of (found ? rows.slice(found.skip) : rows).slice(0, MAX_IMPORT_ROWS)) {
    const rec = fields(row);
    const example = rec.example ? { text: rec.example, translationEs: rec.exampleTranslation ?? "" } : null;
    const last = contents.at(-1); // `at(-1)` (ES2022): última regla creada
    if (!rec.title) {
      // Fila de continuación: solo aporta un ejemplo a la regla anterior
      if (last && example && last.examples.length < MAX_EXAMPLES) last.examples.push(example);
      else skipped += 1;
      continue;
    }
    contents.push({ title: rec.title, explanationEs: rec.explanation ?? "", ...(rec.structure ? { structure: rec.structure } : {}), examples: example ? [example] : [] });
  }
  return { contents, skipped, incomplete: contents.filter((c) => !c.explanationEs).length };
}

// [Etiquetas de sección en documentos de gramática]: «Fórmula: …», «Ejemplos:», «Uso: …» (español e inglés) | `RegExp` con grupos nombrados implícitos por orden
const STRUCTURE_LABEL = /^(?:f[oó]rmula|estructura|structure|form|pattern|patr[oó]n)\s*[:：]\s*/i;
const EXAMPLE_LABEL = /^(?:ejemplos?|examples?|ej\.|e\.g\.)\s*[:：]?\s*/i;
const EXPLANATION_LABEL = /^(?:uso|usos|use|usage|explicaci[oó]n|explanation|regla|rule)\s*[:：]\s*/i;
const BULLET = /^\s*(?:[-•*·▪●◦]|\d+[.)]|[a-z][.)])\s+/i; // Viñetas y numeración (igual que splitLine)
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

// [textToGrammar]: documento libre (PDF, Word, OCR, web) → UNA regla: título (primera línea corta), fórmula (línea con «+» o etiquetada),
// ejemplos (frases en el idioma, con traducción si viene «frase - traducción») y explicación (el resto, en español) | heurística determinista, sin IA
// [Principio]: Deterministic-first + KISS — lo que falte (p. ej. traducciones) lo completa `autofill` con el traductor de la plataforma o el autor
export function textToGrammar(text: string, language: string, fallbackTitle = ""): Record<string, unknown> | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(BULLET, "").trim()) // Se conservan tabuladores y espacios múltiples: separan «frase ⇥ traducción»
    .filter(Boolean);
  const flat = (t: string) => t.replace(/\s+/g, " ").trim(); // Texto guardado: un solo espacio entre palabras
  let title = "";
  let structure = "";
  const explanation: string[] = [];
  const examples: Example[] = [];
  let inExamples = false; // Tras un encabezado «Ejemplos:» las líneas cortas son ejemplos
  for (const raw of lines) {
    // [Fórmula]: etiquetada o patrón con «+» (Sujeto + verbo + complemento)
    if (STRUCTURE_LABEL.test(raw) || (!structure && /\S\s\+\s\S/.test(raw) && raw.length <= 160)) {
      structure ||= flat(raw.replace(STRUCTURE_LABEL, "")); // `||=` (ES2021): solo la primera
      continue;
    }
    const isExampleHeading = EXAMPLE_LABEL.test(raw);
    const line = raw.replace(EXAMPLE_LABEL, "").replace(EXPLANATION_LABEL, "").trim();
    if (isExampleHeading) inExamples = true;
    if (!line) continue;
    // [Título]: primera línea corta sin punto final (encabezado del documento)
    if (!title && !isExampleHeading && line.length <= 80 && !/[.:;!?]$/.test(line)) {
      title = flat(line);
      continue;
    }
    // [Ejemplo con traducción]: «I have eaten. - He comido.» → la 2.ª parte «suena» más a español que la 1.ª
    const pair = splitLine(line);
    if (pair.length >= 2 && words(pair[0]) <= 25 && (language === "es" || spanishScore(pair[1]) > spanishScore(pair[0]))) {
      if (examples.length < MAX_EXAMPLES) examples.push({ text: flat(pair[0]), translationEs: flat(pair.slice(1).join(" ")) });
      continue;
    }
    // [Ejemplo sin traducción]: frase corta en el idioma (sin marcas de español) o bajo «Ejemplos:»
    const sentence = flat(line);
    const short = words(sentence) >= 2 && words(sentence) <= 20;
    if (short && (inExamples || (language !== "es" && spanishScore(sentence) === 0))) {
      if (examples.length < MAX_EXAMPLES && !examples.some((e) => e.text === sentence)) examples.push({ text: sentence, translationEs: "" });
      continue;
    }
    inExamples = false; // Un párrafo largo cierra la lista de ejemplos
    explanation.push(sentence);
  }
  if (!explanation.length && !examples.length && !structure) return null; // Nada utilizable
  return {
    title: (title || fallbackTitle).slice(0, 160), // = text(160) del esquema
    explanationEs: explanation.join("\n").slice(0, 4000), // = text(4000)
    ...(structure ? { structure: structure.slice(0, 300) } : {}),
    examples,
  };
}

// [Extracted · Fuente común de importación]: lo que sale de CUALQUIER origen (archivo, enlace, OCR) → filas de tabla + texto plano
// Cada tipo de recurso decide qué usar: vocabulario/frases prefieren la tabla; las reglas gramaticales, el texto | [Patrón]: Adapter + Strategy | [Principio]: OCP + DRY
export interface Extracted {
  rows: Row[]; // Tabla detectada (Excel, CSV, tabla de Word o de una web); [] si no hay
  text: string; // Texto plano (PDF, Word, OCR, .txt, web); "" en hojas de cálculo
}

// [extractedToContents]: punto de entrada único del importador → contenidos del tipo elegido | `fallbackTitle`: tema del formulario (si el documento no trae título)
export function extractedToContents(kind: CurriculumItemKind, ex: Extracted, language: string, fallbackTitle = ""): ImportResult {
  if (kind === "grammar_rule") {
    // Tabla con encabezados de regla (o una hoja sin texto) → una regla por fila; si no, el documento entero es UNA regla
    if (ex.rows.length && (findHeader(ex.rows) || !ex.text.trim())) return rowsToGrammar(ex.rows);
    const rule = textToGrammar(ex.text || ex.rows.map((r) => r.join(" - ")).join("\n"), language, fallbackTitle);
    return rule ? { contents: [rule], skipped: 0, incomplete: rule.explanationEs ? 0 : 1 } : { contents: [], skipped: 0, incomplete: 0 };
  }
  return rowsToContents(kind, ex.rows.length ? ex.rows : textToRows(ex.text), language);
}
