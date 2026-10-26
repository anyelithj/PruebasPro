import { extractedToContents, textToRows, type Extracted, type Row } from "./resource-import";
import { LANGUAGES } from "./languages";
import { MAX_PARAGRAPHS, READING_GENRE_LABEL, READING_GENRE_OPTIONS, isReadingGenre, textToParagraphs } from "./reading"; // [2026-10-25 · Lectura]
// [activity-kinds · 2026-10-24]: «Crear actividad» de Gestión → Actividades — UNA tabla de estrategias por tipo (práctica, diálogo, gramática, poliglota)
// Cada estrategia declara: campos del formulario, cómo mapear lo importado (Extracted { rows, text } del pipeline de Recursos), cómo pedir el borrador a la IA
// y cómo guardarlo en NestJS. El formulario y las Server Actions son GENÉRICOS: un tipo nuevo = una entrada más aquí
// [Patrón]: Strategy (mapa por tipo) + Adapter (Extracted → borrador · borrador → cuerpo de NestJS) + Port/Adapter (ApiPort inyectado) | [Principio]: OCP + DRY + DIP + SRP
// [Paradigma]: Funcional (funciones puras, sin DOM ni red propia) → se usa en el navegador (formulario) y en el servidor (Server Actions con el token) y se prueba con Jest
// Música no está aquí: la canción tiene su propio asistente (Angular /musica/subir: audio, licencia y letra sincronizada) → la página enlaza a él (no se duplica)

// ─── Tipos comunes ───────────────────────────────────────────────────────────

export type CreatableKind = "practice" | "games" | "dialogues" | "grammar" | "polyglot" | "reading"; // [2026-10-25]: + lectura · + juegos con material propio
export type Entry = Record<string, string>; // Fila editable (ítem, turno, ejemplo, concepto) — todo texto → un solo editor genérico

// [FieldDef]: descripción declarativa de un campo | `ReadonlyArray` (TS): inmutable
export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "checkbox" | "url";
  options?: ReadonlyArray<{ value: string; label: string }>;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  max?: number; // maxLength (= límite del DTO de NestJS)
  wide?: boolean; // Ocupa toda la fila de la rejilla
  manualOnly?: boolean; // [2026-10-25]: solo al escribir a mano o importar (con «Generar con IA» sobra: la IA lo rellena)
}

// [ActivityDraft]: lo que se edita antes de guardar — título + metadatos del tipo + filas
export interface ActivityDraft {
  title: string;
  meta: Record<string, string>;
  entries: Entry[];
}
export interface KindContext {
  language: string;
  level: string;
}
// [ImportSource]: de dónde vino lo importado (nombre del archivo o enlace) → título sugerido y fuente de la licencia
export interface ImportSource {
  label: string;
  url?: string;
  title?: string;
}
// [ApiPort]: único puerto de salida hacia NestJS | [Principio]: DIP → la estrategia no sabe de tokens ni de fetch (lo inyecta la Server Action)
export interface ApiPort {
  post<T>(path: string, body?: unknown): Promise<T>;
}
export interface AiInput {
  topic: string;
  count: number;
  sourceText?: string; // Texto importado (PDF, imagen, audio transcrito…) en el que la IA se basa
  meta: Record<string, string>;
}
// [AiResult]: borrador para revisar (práctica, diálogo) o recurso YA creado por el backend (gramática y poliglota guardan el borrador de la IA)
export type AiResult = { kind: "draft"; draft: Partial<ActivityDraft>; note?: string } | { kind: "created"; id: string };
export interface PersistResult {
  id: string;
  warnings: string[]; // Pasos secundarios que fallaron (la actividad ya existe: se completa en el editor)
}

export interface KindStrategy {
  label: string;
  entryLabel: string; // «Ítem», «Turno»…
  entriesTitle: string;
  minEntries: number;
  meta: ReadonlyArray<FieldDef>;
  entry: ReadonlyArray<FieldDef>;
  emptyEntry: () => Entry;
  defaultMeta: () => Record<string, string>;
  importHint: string;
  fromExtracted: (ex: Extracted, ctx: KindContext, src: ImportSource) => Partial<ActivityDraft>; // [Importar]: Extracted → borrador (determinístico, sin IA)
  ai: {
    hint: string;
    countLabel: string;
    defaultCount: number;
    maxCount: number;
    usesSource: boolean; // La IA puede basarse en el material importado
    run: (input: AiInput, ctx: KindContext, api: ApiPort) => Promise<AiResult>;
  };
  validate: (d: ActivityDraft, ctx: KindContext) => string[];
  persist: (d: ActivityDraft, ctx: KindContext, api: ApiPort) => Promise<PersistResult>;
  mediaUpload?: { path: (id: string) => string; accept: string; label: string; hint: string }; // Audio propio tras crear (diálogos)
}

// ─── Utilidades puras ────────────────────────────────────────────────────────

const enc = encodeURIComponent;
// `normalize("NFD")` + `\p{M}` (Unicode): sin tildes ni mayúsculas → compara encabezados
const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
export const lines = (s = ""): string[] => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const variants = (s: string): string[] => s.split("|").map((v) => v.trim()).filter(Boolean); // «went | had gone» → variantes aceptadas
const rowsOf = (ex: Extracted): Row[] => (ex.rows.length ? ex.rows : textToRows(ex.text)).map((r) => r.map((c) => c.trim()).filter(Boolean)).filter((r) => r.length > 0);
const idOf = (x: unknown): string => String((x as { id?: unknown } | null)?.id ?? ""); // Respuesta de NestJS → id (defensivo ante envoltorios)
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const titleFrom = (src: ImportSource) => (src.title || src.label.replace(/\.[^.]+$/, "")).slice(0, 160);

// [ACTIVITY_ROUTES]: pantallas (remoto Angular) de cada sección → SSOT para la tabla de Gestión y el panel «creada» | [Patrón]: Lookup Table
export const ACTIVITY_ROUTES: Readonly<Record<CreatableKind | "music", { view: (id: string) => string; edit: (id: string) => string }>> = {
  practice: { view: (id) => `/practica/${enc(id)}`, edit: (id) => `/practica/constructor/${enc(id)}` },
  games: { view: () => "/juegos", edit: () => "/admin/activities?tab=games" }, // El enlace real del juego (con su tipo) lo arma la tabla de Gestión
  music: { view: (id) => `/musica/cancion/${enc(id)}`, edit: (id) => `/musica/subir/${enc(id)}` },
  dialogues: { view: (id) => `/dialogos/${enc(id)}`, edit: (id) => `/dialogos/subir/${enc(id)}` },
  polyglot: { view: () => "/poliglota", edit: (id) => `/poliglota/administrar/${enc(id)}` },
  grammar: { view: (id) => `/gramatica/${enc(id)}`, edit: (id) => `/gramatica/editor/${enc(id)}` },
  // [2026-10-25 · Lectura]: el lector del estudiante es Angular (/lectura/:id) · el editor de frases es de Next.js (Gestión)
  reading: { view: (id) => `/lectura/${enc(id)}`, edit: (id) => `/admin/activities/lectura/${enc(id)}` },
};

// [withReturnTo]: añade ?volver=… a una pantalla del remoto Angular → su «Volver» regresa a Gestión | Función pura (la usa también activities-api.withReturn)
export const withReturnTo = (href: string, returnTo: string): string => (href ? `${href}${href.includes("?") ? "&" : "?"}volver=${enc(returnTo)}` : href);

// ─── Práctica ────────────────────────────────────────────────────────────────
// Ítem de NestJS (ItemBody de practice-activities.controller) ↔ fila editable { itemType, prompt, options, answer }

export const ITEM_TYPE_OPTIONS = [
  { value: "multiple_choice", label: "Opción múltiple" },
  { value: "fill_blank", label: "Completar huecos (___)" },
  { value: "match_pairs", label: "Emparejar" },
  { value: "drag_order", label: "Ordenar palabras" },
  { value: "mark_errors", label: "Marcar errores" },
  { value: "open_answer", label: "Respuesta abierta" },
] as const; // `as const` (TS): literales → ItemType se deriva sin repetir la lista
export type ItemType = (typeof ITEM_TYPE_OPTIONS)[number]["value"];
const SKILL_OPTIONS = [
  { value: "vocabulary", label: "Vocabulario" },
  { value: "grammar", label: "Gramática" },
  { value: "structure", label: "Estructura" },
];
export interface PracticeItem {
  itemType: ItemType;
  skill: string;
  prompt: string;
  options: string[];
  accepted: string[][];
  explanation?: string;
}

// [entryToItem]: fila → ItemBody | cada tipo interpreta «respuesta» a su manera (ver `hint` del campo) | [Patrón]: Strategy por itemType
export function entryToItem(e: Entry, skill: string): PracticeItem {
  const itemType = (ITEM_TYPE_OPTIONS.some((o) => o.value === e.itemType) ? e.itemType : "open_answer") as ItemType;
  const options = lines(e.options);
  const base = { itemType, skill, prompt: (e.prompt ?? "").trim(), ...(e.explanation?.trim() ? { explanation: e.explanation.trim() } : {}) };
  switch (itemType) {
    case "multiple_choice":
      return { ...base, options, accepted: [[(e.answer ?? "").trim()]] };
    case "fill_blank":
    case "match_pairs":
      return { ...base, options, accepted: lines(e.answer).map(variants) }; // Una línea por hueco/pareja
    case "drag_order": {
      const tokens = (e.answer ?? "").trim().split(/\s+/).filter(Boolean);
      // `[...tokens].sort()`: sin fichas escritas → las mismas palabras en orden alfabético (desordenadas para el estudiante)
      return { ...base, options: options.length ? options : [...tokens].sort((a, b) => a.localeCompare(b)), accepted: [tokens] };
    }
    case "mark_errors":
      return { ...base, options: [], accepted: [(e.answer ?? "").split(/[\s,;]+/).filter(Boolean)] }; // Índices de palabra (0, 3…)
    default:
      return { ...base, options: [], accepted: [lines(e.answer).flatMap(variants)] }; // open_answer: respuestas modelo
  }
}

// [itemToEntry]: inversa de entryToItem (borrador de la IA → filas editables)
export function itemToEntry(i: Partial<PracticeItem>): Entry {
  const accepted = i.accepted ?? [];
  const answer =
    i.itemType === "multiple_choice"
      ? (accepted[0]?.[0] ?? "")
      : i.itemType === "fill_blank" || i.itemType === "match_pairs"
        ? accepted.map((v) => v.join(" | ")).join("\n")
        : i.itemType === "drag_order"
          ? (accepted[0] ?? []).join(" ")
          : i.itemType === "mark_errors"
            ? (accepted[0] ?? []).join(", ")
            : (accepted[0] ?? []).join("\n");
  return { itemType: i.itemType ?? "open_answer", prompt: i.prompt ?? "", options: (i.options ?? []).join("\n"), answer, explanation: i.explanation ?? "" };
}

// [itemProblem]: reglas mínimas (el backend vuelve a validar con item-rules.ts) → mensajes antes de enviar | null = válido
export function itemProblem(i: PracticeItem): string | null {
  if (!i.prompt) return "falta el enunciado";
  if (!i.accepted.length || i.accepted.some((a) => !a.length)) return "falta la respuesta correcta";
  if (i.itemType === "multiple_choice") {
    if (i.options.length < 2) return "opción múltiple necesita al menos dos opciones";
    if (!i.options.includes(i.accepted[0]![0]!)) return "la respuesta correcta debe ser una de las opciones";
  }
  if (i.itemType === "match_pairs" && i.options.length < 2) return "emparejar necesita al menos dos opciones";
  if (i.itemType === "mark_errors" && !i.accepted[0]!.every((x) => /^\d+$/.test(x))) return "los errores son índices de palabra (0, 1, 2…)";
  return null;
}

const PRACTICE_HEADERS = new Set(["pregunta", "question", "prompt", "enunciado", "frase", "sentence", "item"]);
// [rowsToPracticeEntries]: «pregunta | correcta | distractor…» → opción múltiple · «frase con ___ | respuesta» → huecos · «pregunta | respuesta» → abierta
export function rowsToPracticeEntries(rows: Row[]): Entry[] {
  const body = rows.length && PRACTICE_HEADERS.has(norm(rows[0]![0] ?? "")) ? rows.slice(1) : rows; // Fila de encabezados fuera
  return body
    .filter((r) => r.length >= 2)
    .slice(0, 50) // = ArrayMaxSize(50) del DTO
    .map(([prompt, answer, ...rest]) => {
      if (rest.length) return { itemType: "multiple_choice", prompt: prompt!, answer: answer!, options: [answer!, ...rest].sort((a, b) => a.localeCompare(b)).join("\n"), explanation: "" };
      return { itemType: /_{2,}/.test(prompt!) ? "fill_blank" : "open_answer", prompt: prompt!, answer: answer!, options: "", explanation: "" };
    });
}

const practice: KindStrategy = {
  label: "Práctica",
  entryLabel: "Ítem",
  entriesTitle: "Ítems de la actividad",
  minEntries: 1,
  meta: [
    // [2026-10-25]: como «Generar recurso» → solo tema + qué practica (la descripción y el audio de apoyo se añaden luego en el editor)
    { key: "skill", label: "¿Qué practica?", type: "select", options: SKILL_OPTIONS, required: true },
  ],
  entry: [
    { key: "itemType", label: "Tipo", type: "select", options: ITEM_TYPE_OPTIONS, required: true },
    { key: "prompt", label: "Enunciado", type: "textarea", required: true, max: 2000, placeholder: "I ___ to school yesterday.", wide: true },
    { key: "options", label: "Opciones (una por línea)", type: "textarea", hint: "Opción múltiple, emparejar u ordenar (fichas). Vacío en el resto." },
    { key: "answer", label: "Respuesta correcta", type: "textarea", required: true, hint: "Huecos: una línea por hueco, variantes con «|». Ordenar: la frase. Errores: índices (0, 3)." },
    { key: "explanation", label: "Explicación (opcional)", type: "text", max: 600, wide: true },
  ],
  emptyEntry: () => ({ itemType: "multiple_choice", prompt: "", options: "", answer: "", explanation: "" }),
  defaultMeta: () => ({ skill: "vocabulary", description: "", mediaUrl: "" }),
  importHint: "Una fila o línea por ítem: «pregunta | correcta | distractores…» (opción múltiple), «frase con ___ | respuesta» (huecos) o «pregunta | respuesta».",
  fromExtracted: (ex, _ctx, src) => ({
    title: titleFrom(src),
    entries: rowsToPracticeEntries(rowsOf(ex)),
    // Un enlace de audio/video importado queda vinculado como contenido de apoyo
    ...(src.url && /\.(mp3|wav|m4a|ogg|opus|mp4|webm|mov)(\?|$)/i.test(src.url) ? { meta: { mediaUrl: src.url } } : {}),
  }),
  ai: {
    hint: "La IA local propone ítems variados (opción múltiple, huecos, ordenar, abierta) que revisas antes de guardar.",
    countLabel: "¿Cuántos ítems?",
    defaultCount: 5,
    maxCount: 10, // = @Max(10) de DraftBody
    usesSource: true,
    run: async (input, ctx, api) => {
      const res = await api.post<{ items?: PracticeItem[]; discarded?: number }>("/practice/activities/draft", {
        language: ctx.language,
        level: ctx.level,
        skill: input.meta.skill || "vocabulary",
        topic: input.topic,
        itemTypes: ["multiple_choice", "fill_blank", "drag_order", "open_answer"],
        count: Math.min(Math.max(input.count, 1), 10),
        ...(input.sourceText?.trim() ? { sourceText: input.sourceText.slice(0, 20_000) } : {}),
      });
      const entries = (res.items ?? []).map(itemToEntry);
      return { kind: "draft", draft: { entries }, ...(res.discarded ? { note: `${res.discarded} ítems incoherentes se descartaron.` } : {}) };
    },
  },
  validate: (d) => {
    // `flatMap` (ES2019): un mensaje por ítem con problema, ninguno si es válido
    const problems = d.entries.flatMap((e, i) => {
      const why = itemProblem(entryToItem(e, d.meta.skill || "vocabulary"));
      return why ? [`Ítem ${i + 1}: ${why}.`] : [];
    });
    if (d.meta.mediaUrl && !/^https:\/\/\S+$/.test(d.meta.mediaUrl)) problems.push("El enlace de audio/video debe empezar por https://.");
    return problems;
  },
  persist: async (d, ctx, api) => {
    const skill = d.meta.skill || "vocabulary";
    const created = await api.post("/practice/activities", {
      title: d.title.trim(),
      ...(d.meta.description?.trim() ? { description: d.meta.description.trim() } : {}),
      language: ctx.language,
      level: ctx.level,
      skill,
      items: d.entries.map((e) => entryToItem(e, skill)),
      ...(d.meta.mediaUrl?.trim() ? { contents: [{ kind: "link", label: "Audio / video", href: d.meta.mediaUrl.trim() }] } : {}),
    });
    return { id: idOf(created), warnings: [] };
  },
};

// ─── Juegos con material propio ──────────────────────────────────────────────
// [2026-10-25]: el docente elige el juego de vocabulario y sus palabras (IA, importar URL/PDF/Word, a mano) → NestJS /games/decks · se juega con /juegos/<ruta>?mazo=<id>

export const DECK_GAMES = [
  { value: "flashcards", label: "Flashcards", route: "flashcards" },
  { value: "memory", label: "Parejas", route: "memory" },
  { value: "bingo", label: "Bingo de palabras", route: "bingo" },
  { value: "quick_sort", label: "Clasificación rápida", route: "clasificar" },
  { value: "recovery_drills", label: "Recuperación rápida", route: "recuperacion" },
] as const;
const MAX_DECK = 60; // = MAX_DECK_ITEMS de NestJS
const DECK_HEADERS = new Set(["palabra", "word", "term", "termino", "vocabulario"]);

const games: KindStrategy = {
  label: "Juego",
  entryLabel: "Palabra",
  entriesTitle: "Palabras del juego",
  minEntries: 2,
  meta: [{ key: "gameType", label: "¿Qué juego?", type: "select", options: DECK_GAMES, required: true }],
  entry: [
    { key: "term", label: "Palabra (idioma del juego)", type: "text", required: true, max: 80 },
    { key: "translation", label: "Traducción", type: "text", max: 120 },
    { key: "emoji", label: "Emoji", type: "text", max: 8 },
    { key: "category", label: "Categoría", type: "text", max: 40, hint: "Solo «Clasificación rápida»." },
  ],
  emptyEntry: () => ({ term: "", translation: "", emoji: "", category: "" }),
  defaultMeta: () => ({ gameType: "flashcards" }),
  importHint: "Una fila o línea por palabra: «palabra | traducción | categoría». Un texto suelto (PDF, Word, página) → usa «Generar con IA» basándote en él.",
  fromExtracted: (ex, _ctx, src) => {
    const rows = rowsOf(ex);
    const body = rows.length && DECK_HEADERS.has(norm(rows[0]![0] ?? "")) ? rows.slice(1) : rows;
    // Solo filas cortas (palabra o expresión): un párrafo no es una palabra de juego
    const entries = body.filter((r) => r[0]!.split(/\s+/).length <= 4).slice(0, MAX_DECK).map(([term, translation, category]) => ({ term: term!, translation: translation ?? "", emoji: "", category: category ?? "" }));
    return { title: titleFrom(src), entries };
  },
  ai: {
    hint: "La IA propone palabras del tema con traducción y emoji (o las saca del material importado) para revisar.",
    countLabel: "¿Cuántas palabras?",
    defaultCount: 10,
    maxCount: 30, // = @Max(30) de DraftDeckBody
    usesSource: true,
    run: async (input, ctx, api) => {
      const res = await api.post<{ items?: Entry[] }>("/games/decks/draft", {
        gameType: input.meta.gameType || "flashcards",
        language: ctx.language,
        level: ctx.level,
        topic: input.topic,
        count: Math.min(Math.max(input.count, 4), 30),
        ...(input.sourceText?.trim() ? { sourceText: input.sourceText.slice(0, 20_000) } : {}),
      });
      return { kind: "draft", draft: { entries: (res.items ?? []).map((i) => ({ term: i.term ?? "", translation: i.translation ?? "", emoji: i.emoji ?? "", category: i.category ?? "" })) } };
    },
  },
  validate: (d) => {
    const p: string[] = [];
    const words = d.entries.filter((e) => e.term?.trim());
    if (words.length < 2) p.push("El juego necesita al menos 2 palabras.");
    if (words.length > MAX_DECK) p.push(`Máximo ${MAX_DECK} palabras.`);
    if (d.meta.gameType === "quick_sort" && new Set(words.map((w) => w.category?.trim()).filter(Boolean)).size < 2) p.push("«Clasificación rápida» necesita al menos 2 categorías distintas.");
    return p;
  },
  persist: async (d, ctx, api) => {
    const opt = (v?: string) => (v?.trim() ? v.trim() : undefined);
    const created = await api.post("/games/decks", {
      gameType: d.meta.gameType || "flashcards",
      title: d.title.trim(),
      language: ctx.language,
      level: ctx.level,
      items: d.entries.filter((e) => e.term?.trim()).map((e) => ({ term: e.term!.trim(), translation: opt(e.translation), emoji: opt(e.emoji), category: opt(e.category) })),
    });
    return { id: idOf(created), warnings: [] };
  },
};

// ─── Diálogos ────────────────────────────────────────────────────────────────

const LICENSE_OPTIONS = [
  { value: "own_work", label: "Obra propia" },
  { value: "creative_commons", label: "Creative Commons" },
  { value: "public_domain", label: "Dominio público" },
  { value: "permission", label: "Permiso del titular" },
];
const MAX_TURNS = 80; // = ArrayMaxSize(80) de CreateDialogueBody
// [Línea de guion]: «Ana: Hello!» · «- TOM: Hi» · «A) Hi» — MISMA expresión que parseScript de NestJS (draft-dialogue.use-case) | `u` (Unicode)
const SCRIPT_LINE = /^\s*[-–•]?\s*([\p{Lu}][\p{L}\p{M} .'-]{0,30}?)\s*[:)]\s+(.{1,600})$/u;

// [parseScript]: texto «Nombre: frase» → dos hablantes + turnos A/B | null si no hay guion de dos voces | Función pura
export function parseScript(text: string): { speakers: [string, string]; turns: Entry[] } | null {
  const names: string[] = [];
  const turns: Entry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = SCRIPT_LINE.exec(line);
    if (!m) continue;
    const name = m[1]!.trim();
    if (!names.includes(name)) {
      if (names.length === 2) continue; // Un tercer personaje no cabe en el diálogo de dos voces
      names.push(name);
    }
    turns.push({ speaker: names.indexOf(name) === 0 ? "A" : "B", text: m[2]!.trim() });
    if (turns.length >= MAX_TURNS) break;
  }
  return names.length === 2 && turns.length >= 2 ? { speakers: [names[0]!, names[1]!], turns } : null;
}

const dialogues: KindStrategy = {
  label: "Diálogo",
  entryLabel: "Turno",
  entriesTitle: "Guion del diálogo",
  minEntries: 2,
  meta: [
    { key: "speakerA", label: "Hablante A", type: "text", required: true, max: 40 },
    { key: "speakerB", label: "Hablante B", type: "text", required: true, max: 40 },
    { key: "licenseType", label: "Licencia", type: "select", options: LICENSE_OPTIONS, required: true },
    { key: "licenseHolder", label: "Titular de los derechos", type: "text", required: true, max: 160, placeholder: "Tu nombre, la academia o el autor" },
    { key: "licenseSource", label: "Fuente (enlace o referencia)", type: "text", max: 300, wide: true },
    { key: "licenseConfirmed", label: "Confirmo que tengo derecho a usar este texto en la plataforma", type: "checkbox", required: true, wide: true },
  ],
  entry: [
    { key: "speaker", label: "Habla", type: "select", options: [{ value: "A", label: "A" }, { value: "B", label: "B" }], required: true },
    { key: "text", label: "Frase", type: "textarea", required: true, max: 600, wide: true },
  ],
  emptyEntry: () => ({ speaker: "A", text: "" }),
  defaultMeta: () => ({ speakerA: "Ana", speakerB: "Tom", licenseType: "own_work", licenseHolder: "", licenseSource: "", licenseConfirmed: "" }),
  importHint: "Un guion «Nombre: frase» por línea (dos personajes). Sin nombres, las líneas se alternan entre A y B. Audio/video: se transcribe.",
  fromExtracted: (ex, _ctx, src) => {
    const text = ex.text || ex.rows.map((r) => r.join(": ")).join("\n");
    const script = parseScript(text);
    // [Plan B]: sin guion → cada línea es un turno, alternando A/B (p. ej. transcripción de un audio)
    const turns = script?.turns ?? lines(text).slice(0, MAX_TURNS).map((t, i) => ({ speaker: i % 2 ? "B" : "A", text: t.slice(0, 600) }));
    return {
      title: titleFrom(src),
      entries: turns,
      meta: { ...(script ? { speakerA: script.speakers[0], speakerB: script.speakers[1] } : {}), licenseSource: (src.url ?? src.label).slice(0, 300) },
    };
  },
  ai: {
    hint: "La IA escribe un diálogo original del tema (o extrae el guion del material importado) para revisar.",
    countLabel: "¿Cuántos turnos?",
    defaultCount: 8,
    maxCount: 20, // = @Max(20) de DraftDialogueBody.turns
    usesSource: true,
    run: async (input, ctx, api) => {
      const fromText = Boolean(input.sourceText?.trim());
      const res = await api.post<{ title?: string; speakers?: [string, string]; turns?: Entry[]; source?: string }>("/dialogues/draft", {
        mode: fromText ? "text" : "ai",
        language: ctx.language,
        level: ctx.level,
        topic: input.topic,
        title: input.topic,
        speakers: [input.meta.speakerA || "Ana", input.meta.speakerB || "Tom"],
        turns: Math.min(Math.max(input.count, 4), 20),
        ...(fromText ? { text: input.sourceText!.slice(0, 20_000) } : {}),
      });
      return {
        kind: "draft",
        draft: {
          ...(res.title ? { title: res.title } : {}),
          entries: (res.turns ?? []).map((t) => ({ speaker: t.speaker === "B" ? "B" : "A", text: t.text ?? "" })),
          ...(res.speakers ? { meta: { speakerA: res.speakers[0], speakerB: res.speakers[1] } } : {}),
        },
        ...(res.source === "script" ? { note: "El guion se leyó del material sin usar la IA." } : {}),
      };
    },
  },
  validate: (d) => {
    const p: string[] = [];
    const turns = d.entries.filter((e) => e.text?.trim());
    if (new Set(turns.map((t) => t.speaker)).size < 2) p.push("El diálogo necesita turnos de los dos hablantes.");
    if ((d.meta.licenseHolder ?? "").trim().length < 2) p.push("Indica el titular de los derechos (mín. 2 caracteres).");
    if (d.meta.licenseConfirmed !== "true") p.push("Confirma que puedes usar el texto (licencia).");
    if (turns.length > MAX_TURNS) p.push(`Máximo ${MAX_TURNS} turnos.`);
    return p;
  },
  persist: async (d, ctx, api) => {
    const created = await api.post("/dialogues", {
      title: d.title.trim(),
      language: ctx.language,
      speakers: [d.meta.speakerA?.trim() || "A", d.meta.speakerB?.trim() || "B"],
      turns: d.entries.filter((e) => e.text?.trim()).map((e) => ({ speaker: e.speaker === "B" ? "B" : "A", text: e.text!.trim() })),
      license: { type: d.meta.licenseType || "own_work", source: (d.meta.licenseSource ?? "").trim(), holder: (d.meta.licenseHolder ?? "").trim(), confirmed: true },
    });
    return { id: idOf(created), warnings: [] };
  },
  mediaUpload: { path: (id) => `/api/dialogues/${enc(id)}/audio`, accept: "audio/*,video/mp4,video/webm", label: "Subir audio del diálogo", hint: "Opcional (máx. 20 MB): cada turno se sincroniza con el audio." },
};

// ─── Gramática ───────────────────────────────────────────────────────────────
// Ficha = tema + secciones (uso, fórmula, negativa, interrogativa, nota) + ejemplos | las filas son los ejemplos

const GRAMMAR_SECTIONS = ["usage", "formula", "negative", "interrogative", "note"] as const; // = SECTION_TYPES de NestJS (sin common_errors: se añade en el editor)
const grammar: KindStrategy = {
  label: "Ficha de gramática",
  entryLabel: "Ejemplo",
  entriesTitle: "Ejemplos (en el idioma de la ficha)",
  minEntries: 0,
  meta: [
    { key: "summary", label: "Resumen", type: "textarea", max: 600, wide: true },
    { key: "usage", label: "Uso (cuándo se emplea)", type: "textarea", max: 4000, wide: true },
    { key: "formula", label: "Fórmula (afirmativa)", type: "text", max: 4000, placeholder: "Sujeto + have/has + participio" },
    { key: "negative", label: "Negativa", type: "text", max: 4000 },
    { key: "interrogative", label: "Interrogativa", type: "text", max: 4000 },
    { key: "note", label: "Nota", type: "textarea", max: 4000 },
  ],
  entry: [{ key: "text", label: "Frase de ejemplo", type: "text", required: true, max: 600, wide: true }],
  emptyEntry: () => ({ text: "" }),
  defaultMeta: () => ({ summary: "", usage: "", formula: "", negative: "", interrogative: "", note: "" }),
  importHint: "Un documento = una ficha: título, explicación, «Fórmula: …» y ejemplos (o una tabla «regla | explicación | fórmula | ejemplo»).",
  // [DRY]: MISMO lector de reglas que Recursos (resource-import → textToGrammar / rowsToGrammar)
  fromExtracted: (ex, ctx, src) => {
    const rule = extractedToContents("grammar_rule", ex, ctx.language, titleFrom(src)).contents[0] as { title?: string; explanationEs?: string; structure?: string; examples?: Array<{ text: string }> } | undefined;
    if (!rule) return {};
    return { title: rule.title ?? "", meta: { usage: rule.explanationEs ?? "", formula: rule.structure ?? "" }, entries: (rule.examples ?? []).map((e) => ({ text: e.text })) };
  },
  ai: {
    hint: "La IA crea la ficha completa (secciones y ejemplos con IPA y traducción) y la abre en el editor.",
    countLabel: "",
    defaultCount: 1,
    maxCount: 1,
    usesSource: false,
    run: async (input, ctx, api) => ({ kind: "created", id: idOf(await api.post("/grammar/topics/draft", { title: input.topic, language: ctx.language, level: ctx.level })) }),
  },
  validate: (d) => (GRAMMAR_SECTIONS.some((s) => d.meta[s]?.trim()) || d.entries.some((e) => e.text?.trim()) ? [] : ["Escribe al menos una sección (uso, fórmula…) o un ejemplo."]),
  persist: async (d, ctx, api) => {
    const id = idOf(await api.post("/grammar/topics", { title: d.title.trim(), language: ctx.language, level: ctx.level, status: "draft", ...(d.meta.summary?.trim() ? { summary: d.meta.summary.trim() } : {}) }));
    const warnings: string[] = [];
    // [Pasos secundarios]: la ficha ya existe → un fallo se informa (se completa en el editor) en vez de perder lo creado | [Principio]: Fail-soft
    try {
      const filled = GRAMMAR_SECTIONS.filter((s) => d.meta[s]?.trim());
      const sectionIds: string[] = [];
      for (const [position, type] of filled.entries()) sectionIds.push(idOf(await api.post(`/grammar/topics/${enc(id)}/sections`, { type, body: d.meta[type]!.trim(), position })));
      const examples = d.entries.map((e) => e.text?.trim()).filter((t): t is string => Boolean(t));
      if (examples.length) {
        // Los ejemplos cuelgan de la primera sección (uso); sin secciones se crea una de uso vacía
        const target = sectionIds[0] || idOf(await api.post(`/grammar/topics/${enc(id)}/sections`, { type: "usage", position: 0 }));
        for (const [position, text] of examples.entries()) await api.post(`/grammar/sections/${enc(target)}/examples`, { text, position });
        await api.post(`/grammar/topics/${enc(id)}/enrich`).catch(() => warnings.push("La IPA y la traducción de los ejemplos se completan desde el editor."));
      }
    } catch (e) {
      warnings.push(`Parte del contenido no se guardó (${errMsg(e)}). Complétalo en el editor.`);
    }
    return { id, warnings };
  },
};

// ─── Poliglota ───────────────────────────────────────────────────────────────
// Tema + conceptos (palabra o frase) con su término en cada idioma | las filas son los conceptos, una columna por idioma

const POLY_LANGS = LANGUAGES.map((l) => l.value);
// [Alias de columnas]: código, nombre en español y en inglés → idioma | `Object.fromEntries` (ES2019)
const LANG_ALIASES: Readonly<Record<string, string>> = Object.fromEntries(
  LANGUAGES.flatMap((l) => [l.value, norm(l.label), norm(l.label.split(" ")[0]!)].map((a) => [a, l.value])).concat(
    [["english", "en"], ["spanish", "es"], ["espanol", "es"], ["french", "fr"], ["francais", "fr"], ["german", "de"], ["deutsch", "de"], ["portuguese", "pt"], ["chinese", "zh"], ["mandarin", "zh"], ["russian", "ru"]] as Array<[string, string]>,
  ),
);
// [rowsToConcepts]: con encabezados de idioma → una columna por idioma; sin ellos → «término (idioma del paso 1) | significado en español»
export function rowsToConcepts(rows: Row[], language: string): Entry[] {
  const header = rows[0]?.map((c) => LANG_ALIASES[norm(c)]);
  const hasHeader = Boolean(header && header.filter(Boolean).length >= 2);
  const cols = hasHeader ? header! : [language || "en", "es"];
  return (hasHeader ? rows.slice(1) : rows).slice(0, 200).flatMap((r) => {
    const e: Entry = { kind: "word" };
    r.forEach((cell, i) => {
      if (cols[i]) e[cols[i]!] = cell.slice(0, 200);
    });
    const any = POLY_LANGS.some((l) => e[l]);
    if (!any) return [];
    if (Object.values(e).some((v) => v.trim().split(/\s+/).length > 2)) e.kind = "phrase"; // Más de dos palabras → frase
    return [e];
  });
}

const polyglot: KindStrategy = {
  label: "Tema de poliglota",
  entryLabel: "Concepto",
  entriesTitle: "Palabras y frases (una columna por idioma)",
  minEntries: 0,
  meta: [
    { key: "category", label: "Categoría", type: "select", required: true, options: [{ value: "vocabulary", label: "Vocabulario" }, { value: "phrases", label: "Frases" }, { value: "numbers", label: "Números" }, { value: "grammar", label: "Gramática" }, { value: "other", label: "Otros" }] },
    { key: "description", label: "Descripción", type: "textarea", max: 600, wide: true },
  ],
  entry: [
    { key: "kind", label: "Tipo", type: "select", options: [{ value: "word", label: "Palabra" }, { value: "phrase", label: "Frase" }] },
    ...LANGUAGES.map((l) => ({ key: l.value, label: l.label, type: "text" as const, max: 200 })),
  ],
  emptyEntry: () => ({ kind: "word" }),
  defaultMeta: () => ({ category: "vocabulary", description: "" }),
  importHint: "Tabla con una columna por idioma (encabezados «Inglés | Español | Francés…») o «término | significado en español».",
  fromExtracted: (ex, ctx, src) => ({ title: titleFrom(src), entries: rowsToConcepts(rowsOf(ex), ctx.language) }),
  ai: {
    hint: "Crea el tema y la IA añade palabras en los siete idiomas con IPA; se abre en el editor para revisarlas.",
    countLabel: "¿Cuántas palabras?",
    defaultCount: 8,
    maxCount: 15, // = @Max(15) de PolyglotDraftBody
    usesSource: false,
    run: async (input, _ctx, api) => {
      const id = idOf(await api.post("/polyglot/topics", { title: input.topic, category: input.meta.category || "vocabulary", ...(input.meta.description?.trim() ? { description: input.meta.description.trim() } : {}) }));
      await api.post(`/polyglot/topics/${enc(id)}/draft`, { kind: input.meta.category === "phrases" ? "phrase" : "word", count: Math.min(Math.max(input.count, 1), 15) });
      return { kind: "created", id };
    },
  },
  validate: (d) => d.entries.flatMap((e, i) => (POLY_LANGS.some((l) => e[l]?.trim()) ? [] : [`Concepto ${i + 1}: escribe el término en al menos un idioma.`])),
  persist: async (d, _ctx, api) => {
    const id = idOf(await api.post("/polyglot/topics", { title: d.title.trim(), category: d.meta.category || "vocabulary", ...(d.meta.description?.trim() ? { description: d.meta.description.trim() } : {}) }));
    const warnings: string[] = [];
    for (const [position, e] of d.entries.entries()) {
      try {
        const cid = idOf(await api.post(`/polyglot/topics/${enc(id)}/concepts`, { kind: e.kind === "phrase" ? "phrase" : "word", position, ...(e.es?.trim() ? { gloss: e.es.trim().slice(0, 160) } : {}) }));
        const terms = POLY_LANGS.filter((l) => e[l]?.trim()).map((l) => ({ language: l, text: e[l]!.trim() }));
        if (terms.length) await api.post(`/polyglot/concepts/${enc(cid)}/terms`, { terms }); // NestJS calcula la IPA de cada término
      } catch (err) {
        warnings.push(`Concepto ${position + 1}: ${errMsg(err)}`);
      }
    }
    return { id, warnings };
  },
};

// ─── Lectura ─────────────────────────────────────────────────────────────────
// [2026-10-25]: texto de un género (cuento, fábula, poema, noticia…) · las filas son los PÁRRAFOS (en un poema, estrofas con un verso por línea)
// NestJS divide en frases y añade traducción e IPA por lotes al guardar; las frases se corrigen luego en /admin/activities/lectura/[id]

const isVerse = (meta: Record<string, string>) => meta.genre === "poem";
const READING_WORDS_BY_LEVEL: Readonly<Record<string, number>> = { A1: 120, A2: 180, B1: 250, B2: 350, C1: 450, C2: 500 }; // Dentro de @Min(60) @Max(600)
// [wordCount]: palabras del texto (longitud automática de una lectura escrita o importada) | Función pura
export const wordCount = (entries: Entry[]): number => entries.reduce((n, e) => n + (e.text?.trim() ? e.text.trim().split(/\s+/).length : 0), 0);
const reading: KindStrategy = {
  label: "Lectura",
  entryLabel: "Párrafo",
  entriesTitle: "Texto (un párrafo por bloque)",
  minEntries: 1,
  meta: [
    // [2026-10-25]: con IA basta el género (la longitud la decide el nivel; en un texto propio se cuenta sola) · resumen y autor solo al escribir o importar
    { key: "genre", label: "Género", type: "select", options: READING_GENRE_OPTIONS, required: true },
    { key: "summary", label: "Resumen en español (opcional)", type: "textarea", max: 600, wide: true, placeholder: "De qué trata la lectura…", manualOnly: true },
    { key: "sourceRef", label: "Autor o fuente (opcional)", type: "text", max: 300, wide: true, placeholder: "Esopo · enlace · libro…", manualOnly: true },
  ],
  entry: [{ key: "text", label: "Párrafo", type: "textarea", required: true, max: 4000, wide: true, hint: "En un poema: un verso por línea." }],
  emptyEntry: () => ({ text: "" }),
  defaultMeta: () => ({ genre: "tale", summary: "", sourceRef: "" }),
  importHint: "Cualquier texto (PDF, Word, imagen con OCR o página web): se separa en párrafos. Luego NestJS lo divide en frases con traducción e IPA.",
  fromExtracted: (ex, _ctx, src) => {
    const text = ex.text || ex.rows.map((r) => r.join(" ")).join("\n");
    return { title: titleFrom(src), entries: textToParagraphs(text).map((p) => ({ text: p })), meta: { sourceRef: (src.url ?? src.label).slice(0, 300) } };
  },
  ai: {
    hint: "La IA local escribe un texto original del género, nivel y tema (o adapta el material importado) para revisar.",
    countLabel: "",
    defaultCount: 1,
    maxCount: 1,
    usesSource: true,
    run: async (input, ctx, api) => {
      const genre = isReadingGenre(input.meta.genre) ? input.meta.genre : "tale";
      const res = await api.post<{ title?: string; summary?: string; paragraphs?: string[] }>("/reading/texts/draft", {
        language: ctx.language,
        level: ctx.level,
        genre,
        topic: input.topic,
        words: READING_WORDS_BY_LEVEL[ctx.level.slice(0, 2)] ?? 200, // [2026-10-25]: longitud según el nivel (sin campo «Longitud»)
        ...(input.sourceText?.trim() ? { sourceText: input.sourceText.slice(0, 20_000) } : {}),
      });
      return {
        kind: "draft",
        draft: { entries: (res.paragraphs ?? []).map((text) => ({ text })), meta: { ...(res.summary ? { summary: res.summary } : {}) }, ...(res.title ? { title: res.title } : {}) },
        note: `${READING_GENRE_LABEL[genre]} generado por la IA: revisa el texto antes de guardar.`,
      };
    },
  },
  validate: (d) => {
    const p: string[] = [];
    const paragraphs = d.entries.map((e) => e.text?.trim()).filter(Boolean);
    if (!paragraphs.length) p.push("Escribe, genera o importa el texto (al menos un párrafo).");
    if (paragraphs.length > MAX_PARAGRAPHS) p.push(`Máximo ${MAX_PARAGRAPHS} párrafos.`);
    if (!isReadingGenre(d.meta.genre)) p.push("Elige un género.");
    return p;
  },
  persist: async (d, ctx, api) => {
    const verse = isVerse(d.meta);
    const created = await api.post<{ id?: string; pending?: number }>("/reading/texts", {
      title: d.title.trim(),
      language: ctx.language,
      level: ctx.level,
      genre: d.meta.genre,
      topic: d.title.trim().slice(0, 160),
      ...(d.meta.summary?.trim() ? { summary: d.meta.summary.trim() } : {}),
      ...(d.meta.sourceRef?.trim() ? { sourceRef: d.meta.sourceRef.trim() } : {}),
      // En prosa cada bloque se limpia; en verso se conservan los saltos de línea
      paragraphs: d.entries.flatMap((e) => (e.text?.trim() ? [verse ? e.text.trim() : e.text.replace(/\s+/g, " ").trim()] : [])),
      source: d.meta.sourceRef?.trim() ? "import" : "manual",
    });
    const pending = Number(created?.pending ?? 0);
    return { id: idOf(created), warnings: pending ? [`${pending} frase(s) quedaron sin IPA o traducción; complétalas desde el editor («Completar IPA y traducción»).`] : [] };
  },
};

// ─── Mapa de estrategias (SSOT) ──────────────────────────────────────────────

export const ACTIVITY_KINDS: Readonly<Record<CreatableKind, KindStrategy>> = { practice, games, dialogues, grammar, polyglot, reading };
export const isCreatableKind = (v: unknown): v is CreatableKind => typeof v === "string" && Object.hasOwn(ACTIVITY_KINDS, v); // `Object.hasOwn` (ES2022): sin heredados

// [emptyDraft]: borrador inicial del tipo
export const emptyDraft = (kind: CreatableKind): ActivityDraft => ({ title: "", meta: ACTIVITY_KINDS[kind].defaultMeta(), entries: [] });

// [mergeDraft]: añade lo importado/generado al borrador actual (título solo si estaba vacío; metadatos sin pisar lo escrito) | Función pura
export function mergeDraft(cur: ActivityDraft, add: Partial<ActivityDraft>): ActivityDraft {
  const meta = { ...cur.meta };
  for (const [k, v] of Object.entries(add.meta ?? {})) if (v && !cur.meta[k]?.trim()) meta[k] = v;
  return { title: cur.title.trim() ? cur.title : (add.title ?? ""), meta, entries: [...cur.entries, ...(add.entries ?? [])] };
}

// [validateDraft]: reglas comunes (título, mínimo de filas, obligatorios) + las del tipo
export function validateDraft(kind: CreatableKind, d: ActivityDraft, ctx: KindContext): string[] {
  const s = ACTIVITY_KINDS[kind];
  const p: string[] = [];
  if (kind !== "polyglot" && (!ctx.language || !ctx.level)) p.push("Elige idioma y nivel (paso 1).");
  const minTitle = kind === "practice" ? 3 : 2; // = MinLength de cada DTO de NestJS
  if (d.title.trim().length < minTitle) p.push(`Escribe un título (mín. ${minTitle} caracteres).`);
  for (const f of s.meta) if (f.required && f.type !== "checkbox" && !d.meta[f.key]?.trim()) p.push(`Falta «${f.label}».`);
  if (d.entries.length < s.minEntries) p.push(`Añade al menos ${s.minEntries} ${s.entryLabel.toLowerCase()}${s.minEntries === 1 ? "" : "s"}.`);
  return [...p, ...s.validate(d, ctx)];
}
