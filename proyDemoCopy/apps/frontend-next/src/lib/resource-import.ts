import type { CurriculumItemKind } from "@/types/curriculum";
// [Importación de recursos]: convierte filas de texto (de Excel, Word, PDF, OCR o .txt) en contenidos por tipo de recurso, listos para revisar en el formulario
// [Patrón]: Adapter (formato libre → contenido tipado) + Lookup Table (alias de columnas) + Strategy (armado por tipo) | [Principio]: SRP + OCP (nuevo tipo = nueva entrada) | [Paradigma]: Funcional (funciones puras, sin DOM)
// [Deterministic-first]: reglas explícitas, sin IA; lo que falte lo completa el autor antes de guardar (el backend vuelve a validar)

export type Row = string[];
type Field = "term" | "translation" | "example" | "exampleTranslation" | "emoji" | "ipa" | "incorrect" | "correct" | "explanation" | "gender" | "pos";

// [Tipos importables]: los de estructura simple (una fila = un elemento)
export const IMPORTABLE_KINDS: ReadonlySet<CurriculumItemKind> = new Set(["vocabulary", "example", "translation", "pronunciation", "common_error"]);
export const MAX_IMPORT_ROWS = 500; // Tope por archivo (formularios manejables)

// [Columnas por posición]: si el archivo no trae encabezados | `Readonly<Record<…>>` (TS)
const POSITIONAL: Readonly<Partial<Record<CurriculumItemKind, Field[]>>> = {
  vocabulary: ["term", "translation", "example", "exampleTranslation", "emoji"],
  example: ["term", "translation"],
  translation: ["term", "translation", "explanation"],
  pronunciation: ["term", "ipa"],
  common_error: ["incorrect", "correct", "explanation"],
};

// [Alias de encabezados]: español e inglés, sin tildes ni mayúsculas | [Patrón]: Lookup Table
const ALIASES: Readonly<Record<Field, string[]>> = {
  term: ["palabra", "word", "vocabulario", "vocabulary", "termino", "lemma", "frase", "phrase", "sentence", "oracion", "texto", "text", "original", "source", "expresion", "expression"],
  translation: ["traduccion", "translation", "espanol", "spanish", "significado", "meaning", "es"],
  example: ["ejemplo", "example"],
  exampleTranslation: ["traduccion del ejemplo", "traduccion ejemplo", "example translation"],
  emoji: ["emoji", "icono", "icon"],
  ipa: ["ipa", "pronunciacion", "pronunciation", "fonetica", "transcripcion"],
  incorrect: ["incorrecto", "incorrect", "error", "mal", "wrong"],
  correct: ["correcto", "correct", "bien", "right"],
  explanation: ["explicacion", "explanation", "nota", "notas", "notes", "note"],
  gender: ["genero", "gender"],
  pos: ["tipo", "categoria", "part of speech", "pos", "tipo de palabra"],
};

// [Variante IPA por defecto]: mismo criterio que el backend (la IPA siempre lleva variante del idioma)
const DEFAULT_VARIANT: Readonly<Record<string, string>> = { en: "en-GB", es: "es-ES", fr: "fr-FR", de: "de-DE", pt: "pt-BR", zh: "zh-CN", ru: "ru-RU" };

// [norm]: minúsculas, sin tildes ni signos → compara encabezados | `normalize("NFD")` + `\p{M}` (Unicode)
const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();

// [Separadores de columnas en texto libre]: por prioridad (el primero que aparezca en la línea manda)
const SEPARATORS: ReadonlyArray<RegExp> = [/\t+/, /\s*\|\s*/, /\s*;\s*/, /\s*=\s*/, /\s*(?:→|->|=>)\s*/, /\s+[–—-]\s+/, /:\s+/];

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

// [headerMap]: si la primera fila son encabezados conocidos devuelve columna → campo; si no, null
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
  const header = rows.length ? headerMap(rows[0]) : null;
  let body = (header ? rows.slice(1) : rows).slice(0, MAX_IMPORT_ROWS);
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
};
// [templateRows · 2026-10-23]: filas de la plantilla (las usa la plantilla Excel .xlsx) | `undefined` si el tipo no se importa
export const templateRows = (kind: CurriculumItemKind): string[][] | undefined => TEMPLATES[kind];

export function templateCsv(kind: CurriculumItemKind): string | null {
  const t = TEMPLATES[kind];
  // Comillas dobles escapadas (RFC 4180) | `﻿`: BOM para que Excel detecte UTF-8
  return t ? "﻿" + t.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\r\n") : null;
}
