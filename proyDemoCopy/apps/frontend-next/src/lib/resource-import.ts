import type { CurriculumItemKind } from "@/types/curriculum";
import { detectLanguage, UNDETERMINED } from "@/lib/lang-detect";
import { LANGUAGE_VALUES } from "@/lib/languages";
// [Importación de recursos]: convierte filas de texto (de Excel, Word, PDF, OCR o .txt) en contenidos por tipo de recurso, listos para revisar en el formulario
// [Patrón]: Adapter (formato libre → contenido tipado) + Lookup Table (alias de columnas) + Strategy (armado por tipo) | [Principio]: SRP + OCP (nuevo tipo = nueva entrada) | [Paradigma]: Funcional (funciones puras, sin DOM)
// [Deterministic-first]: reglas explícitas, sin IA; lo que falte lo completa el autor antes de guardar (el backend vuelve a validar)

export type Row = string[];
type Field = "term" | "translation" | "example" | "exampleTranslation" | "emoji" | "ipa" | "incorrect" | "correct" | "explanation" | "gender" | "pos" | "title" | "structure";

// [Tipos importables]: los de estructura simple (una fila = un elemento) + [2026-10-24] reglas gramaticales (documento → una regla; Excel → una regla por fila)
// [2026-10-27]: + ejercicios (hoja de ejercicios en PDF/Word/imagen/web → preguntas numeradas con opciones y respuesta)
export const IMPORTABLE_KINDS: ReadonlySet<CurriculumItemKind> = new Set(["vocabulary", "grammar_rule", "example", "translation", "pronunciation", "common_error", "exercise"]);
export const MAX_IMPORT_ROWS = 500; // Tope por archivo (formularios manejables)

// [Columnas por posición]: si el archivo no trae encabezados | `Readonly<Record<…>>` (TS)
const POSITIONAL: Readonly<Partial<Record<CurriculumItemKind, Field[]>>> = {
  vocabulary: ["term", "translation", "example", "exampleTranslation", "emoji"],
  example: ["term", "translation"],
  translation: ["term", "translation", "explanation"],
  pronunciation: ["term", "ipa"],
  common_error: ["incorrect", "correct", "explanation"],
  grammar_rule: ["title", "explanation", "structure", "example", "exampleTranslation"], // [2026-10-24]: Excel/CSV sin encabezados
  exercise: [], // [2026-10-27]: tiene su propio lector (rowsToExercises / textToExercises); la entrada solo lo marca como importable
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
// [joinOpenParens · Fix 2026-10-30]: el PDF parte una entrada a mitad de paréntesis («el sauce (árbol, / en España)») y cada línea salía como elemento → «en España)» aparecía como palabra
// Mientras queden paréntesis abiertos, la línea siguiente se une a la actual | [Paradigma]: Funcional (pura)
export function joinOpenParens(lines: readonly string[]): string[] {
  const depth = (s: string) => (s.match(/\(/g)?.length ?? 0) - (s.match(/\)/g)?.length ?? 0);
  const out: string[] = [];
  for (const line of lines) {
    const prev = out.at(-1);
    if (prev !== undefined && depth(prev) > 0 && line.trim()) out[out.length - 1] = `${prev} ${line.trim()}`;
    else out.push(line);
  }
  return out;
}

export const textToRows = (text: string): Row[] =>
  joinOpenParens(text.split(/\r?\n/))
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
  // [2026-10-27]: opciones separadas por «|» (vacío = respuesta abierta o verdadero/falso); la respuesta es el texto de la opción o su letra
  exercise: [["pregunta", "opciones", "respuesta", "explicacion"], ["She ___ to school every day.", "go | goes | going", "goes", "Tercera persona del singular: -s."], ["The sun rises in the east. (True/False)", "", "true", ""]],
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
  if (kind === "exercise") {
    // [2026-10-27]: tabla con encabezados de ejercicio (Excel/CSV/tabla de Word o web) → un ejercicio por fila; si no, el texto con preguntas numeradas
    const table = ex.rows.length ? rowsToExercises(ex.rows) : null;
    if (table?.contents.length) return table;
    return textToExercises(ex.text || ex.rows.map((r) => r.join(" ")).join("\n"));
  }
  if (kind === "grammar_rule") {
    // Tabla con encabezados de regla (o una hoja sin texto) → una regla por fila; si no, el documento entero es UNA regla
    if (ex.rows.length && (findHeader(ex.rows) || !ex.text.trim())) return rowsToGrammar(ex.rows);
    const rule = textToGrammar(ex.text || ex.rows.map((r) => r.join(" - ")).join("\n"), language, fallbackTitle);
    return rule ? { contents: [rule], skipped: 0, incomplete: rule.explanationEs ? 0 : 1 } : { contents: [], skipped: 0, incomplete: 0 };
  }
  return rowsToContents(kind, ex.rows.length ? ex.rows : textToRows(ex.text), language);
}

// ───── [2026-10-27] Ejercicios: hoja de ejercicios (PDF, Word, imagen con OCR, web, Excel) → ejercicios editables ─────
// [Patrón]: Adapter + State Machine (pregunta → opciones → respuesta/explicación) | [Principio]: Deterministic-first (sin IA: el docente revisa antes de guardar)
// + SSOT (mismas formas y límites que el esquema Zod de EXERCISE en NestJS) | [Paradigma]: Funcional (funciones puras, sin DOM)
// [Formatos que entiende]: «1. Pregunta» / «1) …» / «Pregunta 1: …» · opciones «a) …», «B. …», «(c) …», «- …» · correcta marcada con «*», «✓», «[x]» o «(correcta)»
// · «Respuesta: b» / «Answer: goes» / «Explicación: …» bajo cada pregunta · o un solucionario al final («Respuestas: 1-b, 2-a» o una línea por número)

type ExerciseType = "multiple_choice" | "true_false" | "fill_blank" | "open_answer";
interface ExerciseDraft { prompt: string; options: string[]; marked: string[]; answers: string[]; explanation: string[] }
const EX_MAX = { prompt: 2000, option: 300, answer: 500, options: 8, answers: 10, explanation: 2000 } as const; // = esquema EXERCISE (NestJS)

const QUESTION = /^\s*(?:(?:pregunta|question|ejercicio|exercise|q)\s*)?(\d{1,3})\s*[.):\-–]\s*(.*)$/i; // «12. …» · «Pregunta 3: …» · «Q4) …»
const OPTION = /^\s*(?:\(?([a-h])\s*[).:]|\(([a-h])\)|[-•*·▪●◦☐□○]|\[\s*[xX✓✔ ]?\s*\])\s*(.+)$/i; // «a) …» «(b) …» «C. …» «- …» «[x] …»
const ANSWER_LINE = /^\s*(?:respuestas?(?:\s+correctas?)?|answers?|correct\s+answers?|soluci[oó]n(?:es)?|solution|clave|key)\s*[:=\-–]\s*(.+)$/i;
const ANSWER_HEADING = /^\s*(?:respuestas|answers|answer\s+key|soluciones|solucionario|clave\s+de\s+respuestas)\s*:?\s*$/i;
const EXPLANATION_LINE = /^\s*(?:explicaci[oó]n|explanation|porque|because|why|nota|note)\s*[:\-–]\s*(.+)$/i;
const MARK = /\s*(?:\*+|✓|✔|\((?:x|correcta?|correct)\)|\[(?:x|✓|✔)\])\s*/gi; // Marcas de «opción correcta» (se quitan del texto)
const MARKED = /^\s*\[\s*[xX✓✔]\s*\]|\*|✓|✔|\((?:x|correcta?|correct)\)|\[(?:x|✓|✔)\]/i;
const TRUE_WORDS = new Set(["true", "verdadero", "v", "t", "vrai", "wahr", "verdadeiro", "yes", "si"]);
const FALSE_WORDS = new Set(["false", "falso", "f", "faux", "falsch", "no"]);
const BLANK = /_{2,}|\.{4,}|…{2,}|\(\s*\)/; // Hueco para completar: «___», «....», «( )»
const TF_HINT = /\b(?:true\s*(?:\/|or|o)\s*false|verdadero\s*(?:\/|o)\s*falso|t\s*\/\s*f|v\s*\/\s*f)\b/i;

const clip = (t: string, max: number) => t.replace(/\s+/g, " ").trim().slice(0, max); // Un espacio entre palabras + límite del esquema
const letterIndex = (l: string) => "abcdefgh".indexOf(l.toLowerCase()); // «b» → 1 · -1 si no es letra de opción
const tfValue = (t: string): "true" | "false" | null => {
  const n = norm(t);
  return TRUE_WORDS.has(n) ? "true" : FALSE_WORDS.has(n) ? "false" : null;
};

// [toContent]: borrador acumulado → contenido EXERCISE (tipo deducido + respuestas coherentes con las opciones)
function toContent(d: ExerciseDraft): Record<string, unknown> | null {
  const prompt = clip(d.prompt, EX_MAX.prompt);
  if (!prompt) return null;
  const options = [...new Set(d.options.map((o) => clip(o, EX_MAX.option)).filter(Boolean))].slice(0, EX_MAX.options);
  const explanationEs = clip(d.explanation.join(" "), EX_MAX.explanation);
  const extra = explanationEs ? { explanationEs } : {};
  const raw = [...d.marked, ...d.answers].map((a) => a.trim()).filter(Boolean);
  // [Verdadero/falso]: dos opciones «Verdadero/Falso», pista «(True/False)» o respuesta «true/falso» sin opciones
  const tfOptions = options.length === 2 && options.every((o) => tfValue(o) !== null);
  const tfAnswer = raw.map(tfValue).find((v) => v !== null) ?? null;
  if (tfOptions || TF_HINT.test(prompt) || (!options.length && tfAnswer)) {
    return { prompt, type: "true_false", answerKey: tfAnswer ? [tfAnswer] : [], ...extra }; // Sin respuesta → [] (el editor obliga a elegir V/F)
  }
  if (options.length >= 2) {
    // [Opción múltiple]: cada respuesta se resuelve a una opción (por letra «b» o por texto) → answerKey ⊆ options (regla del backend)
    const resolved = raw
      .flatMap((a) => a.split(/\s*[,;/]\s*|\s+(?:y|and)\s+/i))
      .map((a) => {
        const byLetter = /^\(?([a-h])\)?[.)]?$/i.exec(a);
        if (byLetter) return options[letterIndex(byLetter[1])];
        return options.find((o) => norm(o) === norm(a.replace(MARK, "")));
      })
      .filter((o): o is string => Boolean(o));
    return { prompt, type: "multiple_choice", options, answerKey: [...new Set(resolved)].slice(0, EX_MAX.answers), ...extra };
  }
  const answers = [...new Set(raw.map((a) => clip(a, EX_MAX.answer)))].slice(0, EX_MAX.answers);
  const type: ExerciseType = BLANK.test(prompt) ? "fill_blank" : "open_answer";
  return { prompt, type, answerKey: answers.length ? answers : [""], ...extra }; // [""] = editor con un campo vacío para escribir la respuesta
}

// [textToExercises]: texto libre → ejercicios | una pregunta empieza con su número; sin números, cada línea con «?» o hueco es una pregunta
export function textToExercises(text: string): ImportResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const numbered = lines.some((l) => QUESTION.test(l) && !ANSWER_HEADING.test(l));
  const drafts = new Map<number, ExerciseDraft>(); // número → borrador (el solucionario final responde por número)
  let current = null as ExerciseDraft | null; // `as`: evita que TS estreche a `null` (se asigna dentro de `start`)
  let auto = 0; // Numeración propia cuando el documento no numera
  let inKey = false; // Dentro del solucionario final
  const start = (n: number, prompt: string) => {
    current = { prompt, options: [], marked: [], answers: [], explanation: [] };
    drafts.set(n, current);
  };
  for (const line of lines) {
    if (ANSWER_HEADING.test(line)) {
      inKey = true;
      continue;
    }
    if (inKey) {
      // «1-b, 2-a, 3-goes» o «1. b» → respuesta del ejercicio con ese número | `matchAll` (ES2020)
      for (const m of line.matchAll(/(\d{1,3})\s*[.):=\-–]\s*([^,;]+)/g)) drafts.get(Number(m[1]))?.answers.push(m[2]!.trim());
      continue;
    }
    const answer = ANSWER_LINE.exec(line);
    if (answer && /^\s*\d{1,3}\s*[.):=\-–]/.test(answer[1]!)) {
      // «Respuestas: 1-b, 2-a» en una sola línea → solucionario por número
      for (const m of answer[1]!.matchAll(/(\d{1,3})\s*[.):=\-–]\s*([^,;]+)/g)) drafts.get(Number(m[1]))?.answers.push(m[2]!.trim());
      continue;
    }
    if (answer && current) {
      current.answers.push(...answer[1]!.split(/\s*[,;]\s*/));
      continue;
    }
    const explanation = EXPLANATION_LINE.exec(line);
    if (explanation && current) {
      current.explanation.push(explanation[1]!);
      continue;
    }
    const q = numbered ? QUESTION.exec(line) : null;
    if (q) {
      start(Number(q[1]), q[2] ?? "");
      continue;
    }
    if (!numbered && (/[?¿]/.test(line) || BLANK.test(line)) && !OPTION.test(line)) {
      start(++auto + 1000, line); // `+ 1000`: no choca con números de un solucionario
      continue;
    }
    const opt = OPTION.exec(line);
    if (opt && current) {
      const value = opt[3]!.replace(MARK, " ").trim();
      current.options.push(value);
      if (MARKED.test(line)) current.marked.push(value);
      // [Opciones en una línea]: «a) go  b) goes  c) going» → se separan por la letra siguiente
      const inline = value.split(/\s+(?=\(?[b-h]\s*[).]\s)/i);
      if (inline.length > 1) {
        const all = [inline[0]!, ...inline.slice(1).map((o) => o.replace(/^\(?[b-h]\s*[).]\s*/i, ""))];
        current.options.splice(-1, 1, ...all.map((o) => o.replace(MARK, " ").trim()));
      }
      continue;
    }
    // [Continuación]: línea suelta antes de las opciones → sigue el enunciado (PDF que corta frases largas)
    if (current && !current.options.length) current.prompt += ` ${line}`;
  }
  const contents: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const d of drafts.values()) {
    const c = toContent(d);
    if (c && contents.length < MAX_IMPORT_ROWS) contents.push(c);
    else skipped += 1;
  }
  return finishExercises(contents, skipped);
}

// [Encabezados de una tabla de ejercicios]: español e inglés, sin tildes | [Patrón]: Lookup Table
const EX_HEADERS: Readonly<Record<"prompt" | "options" | "answer" | "explanation" | "type", string[]>> = {
  prompt: ["pregunta", "question", "enunciado", "prompt", "ejercicio", "exercise", "item", "frase", "sentence"],
  options: ["opciones", "options", "alternativas", "choices"],
  answer: ["respuesta", "respuestas", "answer", "answers", "respuesta correcta", "correct answer", "clave", "key", "solucion", "solution"],
  explanation: ["explicacion", "explanation", "nota", "notas", "notes", "feedback"],
  type: ["tipo", "type", "tipo de ejercicio", "exercise type"],
};
const OPTION_COLUMN = /^(?:opcion|option|alternativa)?\s*([a-h])$/; // Columnas «A | B | C | D» u «Opción A»
const TYPE_ALIASES: Readonly<Record<string, ExerciseType>> = { "multiple choice": "multiple_choice", "opcion multiple": "multiple_choice", "multiple_choice": "multiple_choice", test: "multiple_choice", "true false": "true_false", "verdadero falso": "true_false", "true_false": "true_false", "fill blank": "fill_blank", completar: "fill_blank", "fill_blank": "fill_blank", abierta: "open_answer", "open answer": "open_answer", "open_answer": "open_answer" };

// [rowsToExercises]: tabla con encabezados de ejercicio → un ejercicio por fila | null si la tabla no es de ejercicios (sin columna de pregunta)
export function rowsToExercises(rows: Row[]): ImportResult | null {
  for (let h = 0; h < Math.min(rows.length, HEADER_SCAN); h++) {
    const cols = new Map<number, keyof typeof EX_HEADERS | "option">();
    rows[h]!.forEach((cell, i) => {
      const n = norm(cell);
      const field = (Object.keys(EX_HEADERS) as Array<keyof typeof EX_HEADERS>).find((f) => EX_HEADERS[f].includes(n));
      if (field) cols.set(i, field);
      else if (OPTION_COLUMN.test(n)) cols.set(i, "option");
    });
    if (![...cols.values()].includes("prompt")) continue;
    const contents: Record<string, unknown>[] = [];
    let skipped = 0;
    for (const row of rows.slice(h + 1, h + 1 + MAX_IMPORT_ROWS)) {
      const d: ExerciseDraft = { prompt: "", options: [], marked: [], answers: [], explanation: [] };
      let type: ExerciseType | undefined;
      row.forEach((cell, i) => {
        const v = cell.trim();
        if (!v) return;
        switch (cols.get(i)) {
          case "prompt": d.prompt = v; break;
          case "options": d.options.push(...v.split(/\s*(?:\||;|\n)\s*/)); break; // Opciones en una celda: «go | goes | going»
          case "option": d.options.push(v); break;
          case "answer": d.answers.push(...v.split(/\s*(?:\||;)\s*/)); break;
          case "explanation": d.explanation.push(v); break;
          case "type": type = TYPE_ALIASES[norm(v).replace(/_/g, " ")] ?? TYPE_ALIASES[v]; break;
        }
      });
      const c = toContent(d);
      if (!c) {
        skipped += 1;
        continue;
      }
      // [Tipo declarado en la tabla]: manda sobre el deducido si es coherente (p. ej. «completar» sin «___» en el enunciado)
      if (type && type !== c.type && (type === "fill_blank" || type === "open_answer") && !(c.options as string[] | undefined)?.length) c.type = type;
      contents.push(c);
    }
    return finishExercises(contents, skipped);
  }
  return null;
}

// [finishExercises]: cuenta los incompletos (sin respuesta correcta) → el panel avisa cuántos hay que completar | [Principio]: DRY (texto y tabla)
function finishExercises(contents: Record<string, unknown>[], skipped: number): ImportResult {
  const incomplete = contents.filter((c) => !(c.answerKey as string[]).some((a) => a.trim())).length;
  return { contents, skipped, incomplete };
}

// [onlyLanguage · 2026-11-03]: deja SOLO el contenido del idioma elegido (un PDF/web con secciones en inglés, francés y alemán → solo el del recurso/actividad)
// Se conserva: el español (explicaciones/traducciones), lo indeciso y las líneas cortas (< 3 palabras: palabras sueltas, nombres) · la 1.ª fila de una tabla (encabezados)
// [Patrón]: Filter (función pura) sobre lib/lang-detect | [Principio]: DRY → lo usan «Crear recurso» (ImportPanel) y «Crear actividad» (ActivityCreateForm)
// ponytail: heurística por línea (stopwords), no un detector real → si deja fuera líneas válidas, subir el umbral de palabras
export function onlyLanguage(ex: Extracted, language: string): { ex: Extracted; dropped: number } {
  const lang = language.toLowerCase().split("-")[0] ?? "";
  if (!lang) return { ex, dropped: 0 };
  const candidates = [...new Set([lang, "es", ...LANGUAGE_VALUES])];
  const foreign = (s: string) => {
    if ((s.match(/\p{L}+/gu) ?? []).length < 3) return false;
    const d = detectLanguage(s, candidates);
    return !!d && d !== lang && d !== "es" && d !== UNDETERMINED;
  };
  const lines = ex.text.split("\n");
  const text = lines.filter((l) => !foreign(l)).join("\n");
  const rows = ex.rows.filter((r, i) => i === 0 || !foreign(r.join(" ")));
  return { ex: { rows, text }, dropped: lines.length - text.split("\n").length + ex.rows.length - rows.length };
}
