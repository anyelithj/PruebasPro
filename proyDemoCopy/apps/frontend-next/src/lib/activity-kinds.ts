import { extractedToContents, textToRows, type Extracted, type Row } from "./resource-import";
import { LANGUAGES } from "./languages";
import { mapLimit } from "./map-limit"; // [2026-10-27 · Rendimiento]: peticiones independientes en paralelo acotado
import { DICTATION_MIN_PARAGRAPHS, DICTATION_MIN_SENTENCES, dictationProblems, sentencesIn, READING_KIND_OPTIONS, MAX_PARAGRAPHS, READING_GENRE_LABEL, READING_GENRE_OPTIONS, isReadingGenre, readingWordsFor, textToParagraphs } from "./reading"; // [2026-10-25 · Lectura]
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
  type: "text" | "textarea" | "select" | "checkbox" | "url" | "emoji" | "visual"; // [2026-11-03]: "visual" → VisualAid de Recursos (claves emoji + image) · // [2026-10-30]: "emoji" → campo + selector completo (el de vocabulario)
  options?: ReadonlyArray<{ value: string; label: string }>;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  max?: number; // maxLength (= límite del DTO de NestJS)
  wide?: boolean; // Ocupa toda la fila de la rejilla
  manualOnly?: boolean; // [2026-10-25]: solo al escribir a mano o importar (con «Generar con IA» sobra: la IA lo rellena)
  importOnly?: boolean; // [2026-10-27]: solo con texto de TERCEROS (importado) → licencia/titular; con IA o escrito a mano ni se muestra ni se exige
  when?: (meta: Record<string, string>) => boolean; // [2026-11-11]: campo de fila que depende de los datos (p. ej. «Palabras prohibidas» solo en Tabú)
  labelFor?: (meta: Record<string, string>) => string; // [2026-11-11]: etiqueta según los datos («Palabra», «Tema», «Frase», «Objetivo»)
}

// [DraftOrigin · 2026-10-27]: de dónde salió el contenido del borrador → decide si se piden los datos de derechos | se guarda en `meta.origin`
// «import» domina: si se importó material (aunque luego la IA se base en él) el texto es de terceros | [Patrón]: Value Object (unión de literales)
export type DraftOrigin = "ai" | "own" | "import";
export const ORIGIN_KEY = "origin";
export const draftOrigin = (d: Pick<ActivityDraft, "meta">): DraftOrigin | null => (["ai", "own", "import"].includes(d.meta[ORIGIN_KEY] ?? "") ? (d.meta[ORIGIN_KEY] as DraftOrigin) : null);
// [fieldApplies]: ¿el campo se muestra y valida con este origen? | Función pura (la usan el formulario y validateDraft → mismas reglas en cliente y servidor)
// [2026-11-16]: + `meta` → los campos de datos también pueden depender de otro dato (`when`, p. ej. hablantes solo en «Biblioteca de diálogos»)
export const fieldApplies = (f: FieldDef, origin: DraftOrigin | null, meta?: Record<string, string>): boolean =>
  (!f.manualOnly || origin === "own" || origin === "import") && (!f.importOnly || origin === "import") && (!f.when || !meta || f.when(meta));

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
// [EditApiPort · 2026-10-27]: puerto ampliado para «Editar» (leer, crear, cambiar y quitar filas) — lo construye la Server Action con el token | [Principio]: ISP (crear solo necesita `post`)
export interface EditApiPort extends ApiPort {
  get<T>(path: string): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  del(path: string): Promise<void>;
}
export const ROW_ID = "_id"; // Id de NestJS de cada fila al editar (ítem, turno) → diff: PATCH lo que cambió · POST lo nuevo · DELETE lo quitado
// [EditSpec · 2026-10-27]: edición en Next.js (antes «Editar» abría el editor del remoto Angular) | [Patrón]: Adapter (entidad ↔ borrador) + Diff/Patch
export interface EditSpec {
  path: (id: string) => string; // GET de la entidad con sus filas
  entry?: ReadonlyArray<FieldDef>; // Campos de cada fila al editar (p. ej. diálogos: + IPA y traducción) · sin él, los de crear
  load: (raw: unknown) => { draft: ActivityDraft; ctx: KindContext; status?: string };
  save: (id: string, draft: ActivityDraft, current: ActivityDraft, ctx: KindContext, api: EditApiPort) => Promise<void>;
}
// [diffRows]: filas nuevas, cambiadas (con su id) y quitadas (ids) frente a lo guardado | `fields`: solo se comparan los campos editables | Función pura
export function diffRows(next: Entry[], current: Entry[], fields: ReadonlyArray<string>) {
  const byId = new Map(current.filter((e) => e[ROW_ID]).map((e) => [e[ROW_ID]!, e]));
  const same = (a: Entry, b: Entry) => fields.every((f) => (a[f] ?? "").trim() === (b[f] ?? "").trim());
  return {
    added: next.filter((e) => !e[ROW_ID] || !byId.has(e[ROW_ID])),
    changed: next.filter((e) => e[ROW_ID] && byId.has(e[ROW_ID]) && !same(e, byId.get(e[ROW_ID])!)).map((e) => ({ entry: e, before: byId.get(e[ROW_ID]!)! })),
    removed: [...byId.keys()].filter((id) => !next.some((e) => e[ROW_ID] === id)),
  };
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
  href?: string; // [2026-11-16]: destino tras crear si no es la ficha de Gestión (p. ej. un tema de conversación → /dialogos)
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
  edit?: EditSpec; // [2026-10-27]: «Editar» en una página de Next.js (Gestión → Actividades → …/editar)
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
  // [2026-10-27]: «Editar» de Práctica y Diálogos → página de Next.js (misma interfaz que Recursos) · «Ver» del estudiante sigue en Angular (vista previa embebida sin el marco)
  practice: { view: (id) => `/practica/${enc(id)}`, edit: (id) => `/admin/activities/editar/practice/${enc(id)}` },
  // [2026-10-27]: «Editar» abre el editor del juego con material propio (Next.js) · el enlace real para jugar (con su tipo) lo arma la tabla de Gestión
  games: { view: () => "/juegos", edit: (id) => (id ? `/admin/activities/juegos/mazo/${enc(id)}` : "/admin/activities?tab=games") },
  music: { view: (id) => `/musica/cancion/${enc(id)}`, edit: (id) => `/musica/subir/${enc(id)}` },
  dialogues: { view: (id) => `/dialogos/${enc(id)}`, edit: (id) => `/admin/activities/editar/dialogues/${enc(id)}` },
  polyglot: { view: (id) => `/poliglota?tema=${enc(id)}`, edit: (id) => `/admin/activities/editar/polyglot/${enc(id)}` }, // [2026-11-11]: editor de Next.js
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
    hint: "La IA propone ítems variados (opción múltiple, huecos, ordenar, abierta) que revisas antes de guardar.",
    countLabel: "¿Cuántos ítems?",
    defaultCount: 5,
    maxCount: 10, // = @Max(10) de DraftBody
    usesSource: true,
    run: async (input, ctx, api) => {
      // [Fix 2026-10-30]: 10 ítems de una vez agotaban el plazo de la IA (504 a los 106 s) → tandas de 3 hasta completar
      const total = Math.min(Math.max(input.count, 1), 10);
      let discarded = 0;
      const items = await draftInBatches<PracticeItem>(total, 3, (i) => i.prompt, async (n) => {
        const res = await api.post<{ items?: PracticeItem[]; discarded?: number }>("/practice/activities/draft", {
          language: ctx.language,
          level: ctx.level,
          skill: input.meta.skill || "vocabulary",
          topic: input.topic,
          itemTypes: ["multiple_choice", "fill_blank", "drag_order", "open_answer"],
          count: n,
          ...(input.sourceText?.trim() ? { sourceText: input.sourceText.slice(0, 20_000) } : {}),
        });
        discarded += res.discarded ?? 0;
        return res.items ?? [];
      });
      const note = [shortNote(items.length, total, "ítems"), discarded ? `${discarded} ítems incoherentes se descartaron.` : ""].filter(Boolean).join(" ");
      return { kind: "draft", draft: { entries: items.map(itemToEntry) }, ...(note ? { note } : {}) };
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
  // [edit · 2026-10-27]: datos de la actividad (PATCH) + ítems con diff (PATCH los cambiados · POST los nuevos · DELETE los quitados)
  edit: {
    path: (id) => `/practice/activities/${enc(id)}`,
    load: (raw) => {
      const a = raw as { title: string; description?: string; language: string; level: string; skill: string; status?: string; items?: Array<Partial<PracticeItem> & { id: string }> };
      return {
        draft: { title: a.title, meta: { skill: a.skill, description: a.description ?? "", [ORIGIN_KEY]: "own" }, entries: (a.items ?? []).map((i) => ({ ...itemToEntry(i), [ROW_ID]: i.id })) },
        ctx: { language: a.language, level: a.level },
        status: a.status,
      };
    },
    save: async (id, d, current, ctx, api) => {
      const skill = d.meta.skill || "vocabulary";
      await api.patch(`/practice/activities/${enc(id)}`, { title: d.title.trim(), description: (d.meta.description ?? "").trim(), level: ctx.level, skill });
      const { added, changed, removed } = diffRows(d.entries, current.entries, ["itemType", "prompt", "options", "answer", "explanation"]);
      // `for…of` secuencial: el orden de los ítems nuevos se conserva (NestJS los añade al final)
      for (const { entry } of changed) await api.patch(`/practice/items/${enc(entry[ROW_ID]!)}`, entryToItem(entry, skill));
      for (const e of added) await api.post(`/practice/activities/${enc(id)}/items`, entryToItem(e, skill));
      for (const rid of removed) await api.del(`/practice/items/${enc(rid)}`);
    },
  },
};

// ─── Juegos con material propio ──────────────────────────────────────────────
// [2026-10-25]: el docente elige el juego de vocabulario y sus palabras (IA, importar URL/PDF/Word, a mano) → NestJS /games/decks · se juega con /juegos/<ruta>?mazo=<id>

// [2026-11-11]: los 19 juegos (antes solo 5 de vocabulario) · `family` decide qué es cada fila: palabra, tarjeta, tema, frase u objetivo
export const DECK_GAMES = [
  { value: "flashcards", label: "Flashcards", route: "flashcards", family: "word" },
  { value: "memory", label: "Parejas", route: "memory", family: "word" },
  { value: "bingo", label: "Bingo de palabras", route: "bingo", family: "word" },
  { value: "quick_sort", label: "Clasificación rápida", route: "clasificar", family: "word" },
  { value: "recovery_drills", label: "Recuperación rápida", route: "recuperacion", family: "word" },
  { value: "hangman", label: "Ahorcado", route: "ahorcado", family: "word" },
  { value: "forbidden_word", label: "Palabra prohibida", route: "palabra-prohibida", family: "card" },
  { value: "taboo", label: "Tabú", route: "tabu", family: "card" },
  { value: "twenty_questions", label: "20 preguntas", route: "20-preguntas", family: "card" },
  { value: "describe_guess", label: "Describe y adivina", route: "describe-adivina", family: "card" },
  { value: "chained_story", label: "Historia encadenada", route: "historia", family: "topic" },
  { value: "debate", label: "Debate rápido", route: "debate", family: "topic" },
  { value: "random_topic", label: "Tema al azar", route: "tema", family: "topic" },
  { value: "speed_speaking", label: "Hablar contra reloj", route: "speed-speaking", family: "topic" },
  { value: "role_play", label: "Role-play", route: "role-play", family: "goal" },
  { value: "shadowing", label: "Shadowing", route: "shadowing", family: "line" },
  { value: "partial_dictation", label: "Dictado parcial", route: "dictado", family: "line" },
  { value: "listen_reformulate", label: "Escucha y reformula", route: "reformula", family: "line" },
  { value: "quick_qa", label: "Pregunta-respuesta rápida", route: "pregunta-rapida", family: "line" },
] as const;
export type DeckFamily = (typeof DECK_GAMES)[number]["family"];
export const deckFamily = (gameType?: string): DeckFamily => DECK_GAMES.find((g) => g.value === gameType)?.family ?? "word";
const TERM_LABEL: Record<DeckFamily, string> = { word: "Palabra (idioma del juego)", card: "Palabra secreta (idioma del juego)", topic: "Tema o enunciado (idioma del juego)", line: "Frase (idioma del juego)", goal: "Objetivo (en español)" };
// [deckItemsOf]: filas del borrador → ítems de NestJS (crear y editar) | [Principio]: DRY
export const deckItemsOf = (entries: Entry[]) => {
  const opt = (v?: string) => (v?.trim() ? v.trim() : undefined);
  return entries
    .filter((e) => e.term?.trim())
    .map((e) => ({ term: e.term!.trim(), translation: opt(e.translation), emoji: opt(e.emoji), image: opt(e.image), category: opt(e.category), words: opt(e.words), question: opt(e.question), answer: opt(e.answer) }));
};
const MAX_DECK = 60; // = MAX_DECK_ITEMS de NestJS
const DECK_HEADERS = new Set(["palabra", "word", "term", "termino", "vocabulario"]);

// [draftInBatches · 2026-10-30]: pide a la IA en tandas pequeñas hasta reunir `total` elementos distintos | [Patrón]: Batch + Bounded Retry | [Principio]: Fail-soft (un fallo con algo ya generado no pierde lo anterior)
// Se detiene tras 2 tandas seguidas sin nada nuevo; sin ningún resultado, propaga el error real | `Set` (ES2015): sin repetidos entre tandas (clave normalizada)
export async function draftInBatches<T>(total: number, size: number, keyOf: (x: T) => string, fetchBatch: (n: number) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  const seen = new Set<string>();
  let dry = 0;
  while (out.length < total && dry < 2) {
    try {
      const before = out.length;
      for (const item of await fetchBatch(Math.min(size, total - out.length))) {
        const key = keyOf(item).trim().toLowerCase();
        if (!key || seen.has(key) || out.length >= total) continue;
        seen.add(key);
        out.push(item);
      }
      dry = out.length > before ? 0 : dry + 1;
    } catch (err) {
      if (!out.length) throw err;
      dry++;
    }
  }
  return out;
}

// [shortNote]: aviso honesto si la IA no llegó a la cantidad pedida | Función pura
const shortNote = (got: number, total: number, unit: string): string => (got < total ? `La IA creó ${got} de ${total} ${unit}: añade los que faltan a mano o pulsa «Generar más con IA».` : "");

const games: KindStrategy = {
  label: "Juego",
  entryLabel: "Palabra",
  entriesTitle: "Palabras del juego",
  minEntries: 2,
  meta: [{ key: "gameType", label: "¿Qué juego?", type: "select", options: DECK_GAMES, required: true }],
  entry: [
    { key: "term", label: "Palabra (idioma del juego)", labelFor: (m) => TERM_LABEL[deckFamily(m.gameType)], type: "text", required: true, max: 200 },
    { key: "translation", label: "Traducción", type: "text", max: 120, when: (m) => deckFamily(m.gameType) !== "goal" },
    // [2026-11-03]: «Imagen o emoji» IGUAL que en Recursos → vocabulario (VisualAid: emoji, selector y adjuntar imagen reducida a 256 px) · edita las claves emoji + image
    { key: "visual", label: "Imagen o emoji", type: "visual", wide: true, when: (m) => deckFamily(m.gameType) !== "line" },
    { key: "category", label: "Categoría", type: "text", max: 40, hint: "Grupo de la palabra (obligatorio en «Clasificación rápida»).", when: (m) => deckFamily(m.gameType) === "word" },
    { key: "words", label: "Palabras prohibidas (separadas por comas)", labelFor: (m) => (m.gameType === "role_play" ? "Palabras clave que cumplen el objetivo (comas)" : "Palabras prohibidas (separadas por comas)"), type: "text", max: 200, when: (m) => ["taboo", "forbidden_word", "role_play"].includes(m.gameType ?? "") },
    { key: "question", label: "Pregunta que se escucha tras la frase", type: "text", max: 200, when: (m) => m.gameType === "quick_qa" },
    { key: "answer", label: "Respuesta esperada (una palabra de la frase)", type: "text", max: 80, when: (m) => m.gameType === "quick_qa" },
  ],
  emptyEntry: () => ({ term: "", translation: "", emoji: "", image: "", category: "", words: "", question: "", answer: "" }),
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
      // [Fix 2026-10-30]: la IA devolvía menos de lo pedido (14 de 16) → se piden tandas hasta completar | mínimo 4 por tanda (= @Min(4) de DraftDeckBody)
      const total = Math.min(Math.max(input.count, 4), 30);
      // [2026-11-16]: repetidos entre tandas por SIGNIFICADO («el huevo» / «los huevos») → clave = traducción sin artículo ni plural (o el término)
      const meaning = (i: Entry) => (i.translation || i.term || "").toLowerCase().trim().replace(/^(el|la|los|las)\s+/, "").replace(/(es|s)$/, "");
      const items = await draftInBatches<Entry>(total, 8, meaning, async (n) => {
        const res = await api.post<{ items?: Entry[] }>("/games/decks/draft", {
          gameType: input.meta.gameType || "flashcards",
          language: ctx.language,
          level: ctx.level,
          topic: input.topic,
          count: Math.max(n, 4),
          ...(input.sourceText?.trim() ? { sourceText: input.sourceText.slice(0, 20_000) } : {}),
        });
        return res.items ?? [];
      });
      const note = shortNote(items.length, total, "palabras");
      return { kind: "draft", draft: { entries: items.map((i) => ({ term: i.term ?? "", translation: i.translation ?? "", emoji: i.emoji ?? "", image: "", category: i.category ?? "", words: i.words ?? "", question: i.question ?? "", answer: i.answer ?? "" })) }, ...(note ? { note } : {}) };
    },
  },
  validate: (d) => {
    const p: string[] = [];
    const words = d.entries.filter((e) => e.term?.trim());
    const fam = deckFamily(d.meta.gameType);
    if (words.length < (fam === "word" ? 2 : 1)) p.push(fam === "word" ? "El juego necesita al menos 2 palabras." : "Añade al menos un elemento.");
    if (words.length > MAX_DECK) p.push(`Máximo ${MAX_DECK} elementos.`);
    if (fam === "word" && words.some((w) => w.term!.trim().length > 80)) p.push("Cada palabra admite hasta 80 caracteres.");
    if (d.meta.gameType === "quick_qa" && words.some((w) => !w.question?.trim() || !w.answer?.trim())) p.push("«Pregunta-respuesta rápida» necesita pregunta y respuesta en cada frase.");
    if (d.meta.gameType === "role_play" && words.some((w) => !w.words?.trim())) p.push("Cada objetivo de role-play necesita sus palabras clave.");
    if (d.meta.gameType === "quick_sort" && new Set(words.map((w) => w.category?.trim()).filter(Boolean)).size < 2) p.push("«Clasificación rápida» necesita al menos 2 categorías distintas.");
    return p;
  },
  persist: async (d, ctx, api) => {
    const created = await api.post("/games/decks", {
      gameType: d.meta.gameType || "flashcards",
      title: d.title.trim(),
      language: ctx.language,
      level: ctx.level,
      items: deckItemsOf(d.entries),
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

// [Tipo de diálogo · 2026-11-16]: «Biblioteca de diálogos» (guion A/B) o «Tema de conversación» (el estudiante conversa con el avatar; filas = objetivos)
// Mismo paso y mismos botones; los campos cambian con `when` / `labelFor` | [Patrón]: Strategy con variantes por dato | [Principio]: DRY (un solo formulario)
const DIALOGUE_TYPES = [
  { value: "library", label: "Biblioteca de diálogos" },
  { value: "topic", label: "Tema de conversación" },
] as const;
const isTopic = (meta: Record<string, string>) => meta.dialogueType === "topic";
const notTopic = (meta: Record<string, string>) => !isTopic(meta);
const MAX_OBJECTIVES = 8; // = ArrayMaxSize(8) de TopicBody.objectives

const dialogues: KindStrategy = {
  label: "Diálogo",
  entryLabel: "Turno u objetivo",
  entriesTitle: "Guion u objetivos",
  minEntries: 2,
  meta: [
    { key: "dialogueType", label: "Tipo de diálogo", type: "select", options: DIALOGUE_TYPES, required: true },
    { key: "speakerA", label: "Hablante A", type: "text", required: true, max: 40, when: notTopic },
    { key: "speakerB", label: "Hablante B", type: "text", required: true, max: 40, when: notTopic },
    // [2026-10-27 · Bug «Falta Titular de los derechos» con IA]: los datos de derechos solo aplican a texto de TERCEROS (importado) → `importOnly`
    // Con IA o escrito a mano NestJS lo guarda como «obra propia» de la academia (resolveLicense) | [Principio]: no pedir datos que no aplican
    { key: "licenseType", label: "Licencia", type: "select", options: LICENSE_OPTIONS, required: true, importOnly: true, when: notTopic },
    { key: "licenseHolder", label: "Titular de los derechos", type: "text", required: true, max: 160, placeholder: "Autor, editorial o sitio del que lo tomaste", importOnly: true, when: notTopic },
    { key: "licenseSource", label: "Fuente (enlace o referencia)", type: "text", max: 300, wide: true, importOnly: true, when: notTopic },
    { key: "licenseConfirmed", label: "Confirmo que tengo derecho a usar este texto en la plataforma", type: "checkbox", required: true, wide: true, importOnly: true, when: notTopic },
  ],
  entry: [
    { key: "speaker", label: "Habla", type: "select", options: [{ value: "A", label: "A" }, { value: "B", label: "B" }], required: true, when: notTopic },
    { key: "text", label: "Frase", type: "textarea", required: true, max: 600, wide: true, labelFor: (m) => (isTopic(m) ? "Objetivo (lo que el estudiante debe lograr al conversar)" : "Frase") },
  ],
  emptyEntry: () => ({ speaker: "A", text: "" }),
  defaultMeta: () => ({ dialogueType: "library", speakerA: "Ana", speakerB: "Tom", licenseType: "own_work", licenseHolder: "", licenseSource: "", licenseConfirmed: "" }),
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
      // [Tema de conversación]: objetivos con la MISMA IA que los objetivos del juego de rol (/games/decks/draft · role_play: metas en español)
      if (isTopic(input.meta)) {
        const res = await api.post<{ items?: Entry[] }>("/games/decks/draft", { gameType: "role_play", language: ctx.language, level: ctx.level, topic: input.topic, count: Math.min(Math.max(input.count, 4), MAX_OBJECTIVES) });
        return { kind: "draft", draft: { entries: (res.items ?? []).slice(0, MAX_OBJECTIVES).map((i) => ({ speaker: "A", text: i.term ?? "" })) }, note: "Objetivos del tema de conversación: revísalos antes de guardar." };
      }
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
    if (isTopic(d.meta)) return turns.length > MAX_OBJECTIVES ? [`Máximo ${MAX_OBJECTIVES} objetivos.`] : []; // Sin hablantes ni licencia
    if (new Set(turns.map((t) => t.speaker)).size < 2) p.push("El diálogo necesita turnos de los dos hablantes.");
    // [2026-10-27]: derechos solo con texto importado (de terceros)
    if (draftOrigin(d) === "import") {
      if ((d.meta.licenseHolder ?? "").trim().length < 2) p.push("Indica el titular de los derechos (mín. 2 caracteres).");
      if (d.meta.licenseConfirmed !== "true") p.push("Confirma que puedes usar el texto (licencia).");
    }
    if (turns.length > MAX_TURNS) p.push(`Máximo ${MAX_TURNS} turnos.`);
    return p;
  },
  persist: async (d, ctx, api) => {
    // [Tema de conversación]: POST /dialogues/topics (título, idioma, nivel y objetivos) → se ve en Diálogos → Temas de conversación
    if (isTopic(d.meta)) {
      const topic = await api.post("/dialogues/topics", {
        title: d.title.trim().slice(0, 120),
        language: ctx.language,
        ...(ctx.level ? { levels: [ctx.level] } : {}),
        objectives: d.entries.map((e) => e.text?.trim() ?? "").filter(Boolean).slice(0, MAX_OBJECTIVES),
      });
      return { id: idOf(topic), warnings: [], href: "/dialogos" };
    }
    const created = await api.post("/dialogues", {
      title: d.title.trim(),
      language: ctx.language,
      speakers: [d.meta.speakerA?.trim() || "A", d.meta.speakerB?.trim() || "B"],
      turns: d.entries.filter((e) => e.text?.trim()).map((e) => ({ speaker: e.speaker === "B" ? "B" : "A", text: e.text!.trim() })),
      ...(ctx.level ? { level: ctx.level } : {}), // [2026-10-27]: el nivel del paso 1 → se puede publicar aunque el clasificador no responda
      // [2026-10-27]: origen → NestJS pone «obra propia» a lo generado/escrito y exige la licencia solo a lo importado
      origin: draftOrigin(d) ?? "own",
      ...(draftOrigin(d) === "import"
        ? { license: { type: d.meta.licenseType || "own_work", source: (d.meta.licenseSource ?? "").trim(), holder: (d.meta.licenseHolder ?? "").trim(), confirmed: d.meta.licenseConfirmed === "true" } }
        : {}),
    });
    return { id: idOf(created), warnings: [] };
  },
  mediaUpload: { path: (id) => `/api/dialogues/${enc(id)}/audio`, accept: "audio/*,video/mp4,video/webm", label: "Subir audio del diálogo", hint: "Opcional (máx. 20 MB): cada turno se sincroniza con el audio." },
  // [edit · 2026-10-27]: título, hablantes y nivel (PATCH /dialogues/:id) + turnos con diff · IPA y traducción editables (la corrección manual prevalece)
  // Si cambia el texto y NO se tocaron IPA/traducción, se vacían → NestJS los vuelve a generar al abrir el diálogo (GetDialogue rellena lo que falta)
  edit: {
    path: (id) => `/dialogues/${enc(id)}`,
    entry: [
      { key: "speaker", label: "Habla", type: "select", options: [{ value: "A", label: "A" }, { value: "B", label: "B" }], required: true },
      { key: "text", label: "Frase", type: "textarea", required: true, max: 600, wide: true },
      { key: "ipa", label: "IPA", type: "text", max: 800, hint: "Vacío = se genera sola." },
      { key: "translation", label: "Traducción al español", type: "text", max: 800, hint: "Vacío = se genera sola." },
    ],
    load: (raw) => {
      const x = raw as { title: string; language: string; level: string | null; levelStatus?: string; speakers?: string[]; turns?: Array<{ id: string; speaker: string; text: string; ipa?: string | null; translation?: string | null }> };
      return {
        draft: {
          title: x.title,
          meta: { dialogueType: "library", speakerA: x.speakers?.[0] ?? "A", speakerB: x.speakers?.[1] ?? "B", [ORIGIN_KEY]: "own" }, // Ya guardado → la licencia no se vuelve a pedir
          entries: (x.turns ?? []).map((t) => ({ speaker: t.speaker === "B" ? "B" : "A", text: t.text, ipa: t.ipa ?? "", translation: t.translation ?? "", [ROW_ID]: t.id })),
        },
        ctx: { language: x.language, level: x.level ?? "" },
        status: x.levelStatus === "confirmed" ? "published" : "draft",
      };
    },
    save: async (id, d, current, ctx, api) => {
      await api.patch(`/dialogues/${enc(id)}`, { title: d.title.trim(), speakers: [d.meta.speakerA?.trim() || "A", d.meta.speakerB?.trim() || "B"], ...(ctx.level ? { level: ctx.level } : {}) });
      const { added, changed, removed } = diffRows(d.entries.filter((e) => e.text?.trim()), current.entries, ["speaker", "text", "ipa", "translation"]);
      for (const { entry: e, before } of changed) {
        const textChanged = e.text!.trim() !== (before.text ?? "").trim();
        const keep = (k: "ipa" | "translation") => (textChanged && (e[k] ?? "") === (before[k] ?? "") ? "" : (e[k] ?? "").trim()); // Texto nuevo + IPA vieja → se regenera
        await api.patch(`/dialogue-turns/${enc(e[ROW_ID]!)}`, { speaker: e.speaker === "B" ? "B" : "A", text: e.text!.trim(), ipa: keep("ipa"), translation: keep("translation") });
      }
      for (const e of added) await api.post(`/dialogues/${enc(id)}/turns`, { speaker: e.speaker === "B" ? "B" : "A", text: e.text!.trim() });
      for (const rid of removed) await api.del(`/dialogue-turns/${enc(rid)}`);
    },
  },
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
        // [2026-10-27 · Rendimiento]: `?defer=true` → NestJS guarda y responde al instante; la IPA + traducción de TODOS los ejemplos se piden juntas en segundo plano
        // (antes: una llamada al LLM por ejemplo + otra para la ficha entera, en serie → minutos, y la ruta caía a los 30 s) | Se ven al abrir el editor
        for (const [position, text] of examples.entries()) await api.post(`/grammar/sections/${enc(target)}/examples?defer=true`, { text, position });
      }
    } catch (e) {
      warnings.push(`Parte del contenido no se guardó (${errMsg(e)}). Complétalo en el editor.`);
    }
    return { id, warnings };
  },
};

// ─── Poliglota ───────────────────────────────────────────────────────────────
const POLY_PARALLEL = 3; // [2026-10-27]: conceptos guardados a la vez (≤ cupo del throttler de NestJS y de procesos espeak-ng de FastAPI)
// Tema + conceptos (palabra o frase) con su término en cada idioma | las filas son los conceptos, una columna por idioma

const POLY_LANGS = LANGUAGES.map((l) => l.value);
// [polyLangs · 2026-11-11]: idiomas elegidos en el multiselect de Poliglota (`meta.languages` = «en,fr,…») · vacío = los siete
export const polyLangs = (meta: Record<string, string>): string[] => {
  const picked = (meta.languages ?? "").split(",").filter((l) => (POLY_LANGS as string[]).includes(l));
  return picked.length ? picked : POLY_LANGS;
};
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
    ...LANGUAGES.map((l) => ({ key: l.value, label: l.label, type: "text" as const, max: 200, when: (m: Record<string, string>) => polyLangs(m).includes(l.value) })), // Solo las columnas de los idiomas elegidos
    // [2026-11-11]: UN campo «Imagen o emoji» (MISMO VisualAid que Recursos y Juegos): emoji o imagen adjunta → `emoji` / `image` (data URL → imageUrl en NestJS)
    { key: "visual", label: "Imagen o emoji", type: "visual", wide: true },
  ],
  emptyEntry: () => ({ kind: "word", emoji: "", image: "" }),
  defaultMeta: () => ({ category: "vocabulary", description: "", languages: "" }),
  importHint: "Tabla con una columna por idioma (encabezados «Inglés | Español | Francés…») o «término | significado en español».",
  fromExtracted: (ex, ctx, src) => ({ title: titleFrom(src), entries: rowsToConcepts(rowsOf(ex), ctx.language) }),
  ai: {
    hint: "Crea el tema y la IA añade palabras en los siete idiomas con IPA; se abre en el editor para revisarlas.",
    countLabel: "¿Cuántas palabras?",
    defaultCount: 8,
    maxCount: 15, // = @Max(15) de PolyglotDraftBody
    usesSource: false,
    run: async (input, ctx, api) => {
      const id = idOf(await api.post("/polyglot/topics", polyTopicBody({ title: input.topic, meta: input.meta, entries: [] }, ctx)));
      await api.post(`/polyglot/topics/${enc(id)}/draft`, { kind: input.meta.category === "phrases" ? "phrase" : "word", count: Math.min(Math.max(input.count, 1), 15), languages: polyLangs(input.meta) });
      return { kind: "created", id };
    },
  },
  validate: (d) =>
    d.entries.flatMap((e, i) => [
      ...(polyLangs(d.meta).some((l) => e[l]?.trim()) ? [] : [`Concepto ${i + 1}: escribe el término en al menos un idioma.`]),
    ]),
  persist: async (d, ctx, api) => {
    const id = idOf(await api.post("/polyglot/topics", polyTopicBody(d, ctx)));
    // [2026-10-27 · Rendimiento]: antes un concepto tras otro (2 peticiones + IPA de cada término, encadenadas) → ahora POLY_PARALLEL conceptos a la vez
    // `position` explícita → el orden no depende de cuál termine antes | un fallo solo afecta a su concepto (Fail-soft)
    return { id, warnings: await addConcepts(id, d.entries, d.meta, 0, api) };
  },
  // [edit · 2026-11-11]: «Editar» en Next.js (antes el editor Angular /poliglota/administrar) — tema (título, nivel, idiomas, categoría) + conceptos con diff
  // Se lee la tabla con los siete idiomas → los términos de un idioma desmarcado no se pierden | `_t_<idioma>`: id del término (para borrarlo si se vacía)
  edit: {
    path: (id) => `/polyglot/table?topic=${enc(id)}&languages=${POLY_LANGS.join(",")}`,
    load: (raw) => {
      const x = raw as { topic: { title: string; category?: string; description?: string; levels?: string[]; languages?: string[]; status?: string }; rows: Array<{ concept: { id: string; kind?: string; emoji?: string; imageUrl?: string | null }; terms: Record<string, { id: string; text: string } | null> }> };
      return {
        draft: {
          title: x.topic.title,
          meta: { category: x.topic.category ?? "vocabulary", description: x.topic.description ?? "", languages: (x.topic.languages ?? []).join(","), [ORIGIN_KEY]: "own" },
          entries: x.rows.map(({ concept: c, terms }) => ({
            kind: c.kind === "phrase" ? "phrase" : "word",
            emoji: c.emoji ?? "",
            image: c.imageUrl ?? "",
            [ROW_ID]: c.id,
            ...Object.fromEntries(Object.entries(terms).flatMap(([l, t]) => (t ? [[l, t.text], [`_t_${l}`, t.id]] : []))),
          })),
        },
        ctx: { language: "", level: x.topic.levels?.[0] ?? "" },
        status: x.topic.status,
      };
    },
    save: async (id, d, current, ctx, api) => {
      await api.patch(`/polyglot/topics/${enc(id)}`, polyTopicBody(d, ctx));
      const { added, changed, removed } = diffRows(d.entries, current.entries, ["kind", "emoji", "image", ...POLY_LANGS]);
      const langs = polyLangs(d.meta);
      await mapLimit(changed, POLY_PARALLEL, async ({ entry: e, before }) => {
        const cid = enc(e[ROW_ID]!);
        await api.patch(`/polyglot/concepts/${cid}`, conceptBody(e));
        const terms = langs.filter((l) => e[l]?.trim() && e[l]!.trim() !== (before[l] ?? "").trim()).map((l) => ({ language: l, text: e[l]!.trim() }));
        if (terms.length) await api.post(`/polyglot/concepts/${cid}/terms`, { terms }); // Upsert: texto nuevo → NestJS rehace la IPA
        for (const l of langs) if (!e[l]?.trim() && before[`_t_${l}`]) await api.del(`/polyglot/terms/${enc(before[`_t_${l}`]!)}`); // Vaciado → se borra
      });
      for (const cid of removed) await api.del(`/polyglot/concepts/${enc(cid)}`);
      const warnings = await addConcepts(id, added, d.meta, current.entries.length, api);
      if (warnings.length) throw new Error(warnings.join(" "));
    },
  },
};

// [polyTopicBody]: borrador → cuerpo del tema en NestJS (crear y editar) | nivel del paso 2 · idiomas del multiselect
function polyTopicBody(d: ActivityDraft, ctx: KindContext) {
  return { title: d.title.trim(), category: d.meta.category || "vocabulary", description: (d.meta.description ?? "").trim(), levels: ctx.level ? [ctx.level] : [], languages: polyLangs(d.meta) };
}
// [conceptBody]: fila → concepto | glosa = término en español si lo hay · imagen: data URL adjunta o enlace https (null = quitarla)
const conceptBody = (e: Entry) => ({ kind: e.kind === "phrase" ? "phrase" : "word", emoji: (e.emoji ?? "").trim(), imageUrl: e.image?.trim() || null, ...(e.es?.trim() ? { gloss: e.es.trim().slice(0, 160) } : {}) });
// [addConcepts]: crea conceptos + términos en paralelo acotado (POLY_PARALLEL) · `position` explícita → orden estable · un fallo solo afecta a su concepto (Fail-soft)
async function addConcepts(topicId: string, entries: Entry[], meta: Record<string, string>, offset: number, api: ApiPort): Promise<string[]> {
  const results = await mapLimit(entries, POLY_PARALLEL, async (e, i): Promise<string | null> => {
    try {
      const { imageUrl, ...rest } = conceptBody(e);
      const cid = idOf(await api.post(`/polyglot/topics/${enc(topicId)}/concepts`, { ...rest, position: offset + i, ...(imageUrl ? { imageUrl } : {}) }));
      const terms = polyLangs(meta).filter((l) => e[l]?.trim()).map((l) => ({ language: l, text: e[l]!.trim() }));
      if (terms.length) await api.post(`/polyglot/concepts/${enc(cid)}/terms`, { terms }); // NestJS calcula la IPA de cada término (espeak, en paralelo acotado)
      return null;
    } catch (err) {
      return `Concepto ${offset + i + 1}: ${errMsg(err)}`;
    }
  });
  return results.filter((w): w is string => w !== null);
}

// ─── Lectura ─────────────────────────────────────────────────────────────────
// [2026-10-25]: texto de un género (cuento, fábula, poema, noticia…) · las filas son los PÁRRAFOS (en un poema, estrofas con un verso por línea)
// NestJS divide en frases y añade traducción e IPA por lotes al guardar; las frases se corrigen luego en /admin/activities/lectura/[id]

const isVerse = (meta: Record<string, string>) => meta.genre === "poem";
// [wordCount]: palabras del texto (longitud automática de una lectura escrita o importada) | Función pura
export const wordCount = (entries: Entry[]): number => entries.reduce((n, e) => n + (e.text?.trim() ? e.text.trim().split(/\s+/).length : 0), 0);
const reading: KindStrategy = {
  label: "Lectura",
  entryLabel: "Párrafo",
  entriesTitle: "Texto (un párrafo por bloque)",
  minEntries: 1,
  meta: [
    // [2026-10-25]: con IA basta el género (la longitud la decide el nivel; en un texto propio se cuenta sola) · resumen y autor solo al escribir o importar
    // [2026-11-16 · Dictado]: el mismo texto sirve de lectura o de dictado (/lectura/dictado) · dictado = ≥ 3 párrafos de ≥ 5 frases
    { key: "kind", label: "Tipo", type: "select", options: READING_KIND_OPTIONS, required: true },
    { key: "genre", label: "Género", type: "select", options: READING_GENRE_OPTIONS, required: true },
    { key: "summary", label: "Resumen en español (opcional)", type: "textarea", max: 600, wide: true, placeholder: "De qué trata la lectura…", manualOnly: true },
    { key: "sourceRef", label: "Autor o fuente (opcional)", type: "text", max: 300, wide: true, placeholder: "Esopo · enlace · libro…", manualOnly: true },
  ],
  entry: [{ key: "text", label: "Párrafo", type: "textarea", required: true, max: 4000, wide: true, hint: "En un poema: un verso por línea." }],
  emptyEntry: () => ({ text: "" }),
  defaultMeta: () => ({ kind: "reading", genre: "tale", summary: "", sourceRef: "" }),
  importHint: "Cualquier texto (PDF, Word, imagen con OCR o página web): se separa en párrafos. Luego NestJS lo divide en frases con traducción e IPA.",
  fromExtracted: (ex, _ctx, src) => {
    const text = ex.text || ex.rows.map((r) => r.join(" ")).join("\n");
    return { title: titleFrom(src), entries: textToParagraphs(text).map((p) => ({ text: p })), meta: { sourceRef: (src.url ?? src.label).slice(0, 300) } };
  },
  ai: {
    hint: "La IA escribe un texto original del género, nivel y tema (o adapta el material importado) para revisar.",
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
        // [2026-11-16]: dictado → `kind` y sin `words` → NestJS pide 3 párrafos × 5–6 frases (texto más corto: el modelo local no agota el plazo)
        ...(input.meta.kind === "dictation" ? { kind: "dictation" } : { words: readingWordsFor(ctx.level) }), // [2026-10-28]: longitud según el nivel (≥ 6 párrafos × ~5 frases; tabla en lib/reading)
        ...(input.sourceText?.trim() ? { sourceText: input.sourceText.slice(0, 20_000) } : {}),
      });
      const paragraphs = res.paragraphs ?? [];
      // [Fix 2026-11-17 · Dictado corto]: el modelo local a veces no llega al mínimo en el plazo → se avisa AQUÍ, con la cuenta, en vez de solo al pulsar «Crear actividad»
      const total = paragraphs.reduce((n, p) => n + sentencesIn(p), 0);
      const short = input.meta.kind === "dictation" && dictationProblems(paragraphs).length > 0;
      return {
        kind: "draft",
        draft: { entries: paragraphs.map((text) => ({ text })), meta: { ...(res.summary ? { summary: res.summary } : {}) }, ...(res.title ? { title: res.title } : {}) },
        note: short
          ? `La IA solo escribió ${total} frase(s) en ${paragraphs.length} párrafo(s) y un dictado necesita al menos ${DICTATION_MIN_PARAGRAPHS} párrafos de ${DICTATION_MIN_SENTENCES} frases (${DICTATION_MIN_PARAGRAPHS * DICTATION_MIN_SENTENCES} en total). Completa el texto a mano o borra los párrafos y vuelve a generar.`
          : `${READING_GENRE_LABEL[genre]} generado por la IA: revisa el texto antes de guardar.`,
      };
    },
  },
  validate: (d) => {
    const p: string[] = [];
    const paragraphs = d.entries.map((e) => e.text?.trim()).filter(Boolean);
    if (!paragraphs.length) p.push("Escribe, genera o importa el texto (al menos un párrafo).");
    if (paragraphs.length > MAX_PARAGRAPHS) p.push(`Máximo ${MAX_PARAGRAPHS} párrafos.`);
    if (!isReadingGenre(d.meta.genre)) p.push("Elige un género.");
    if (d.meta.kind === "dictation" && paragraphs.length) p.push(...dictationProblems(paragraphs as string[]));
    return p;
  },
  persist: async (d, ctx, api) => {
    const verse = isVerse(d.meta);
    const created = await api.post<{ id?: string; pending?: number; enriching?: boolean }>("/reading/texts", {
      title: d.title.trim(),
      language: ctx.language,
      ...(ctx.level ? { level: ctx.level } : {}), // [2026-11-16 · RF-148]: sin nivel → NestJS lo estima del texto
      genre: d.meta.genre,
      kind: d.meta.kind === "dictation" ? "dictation" : "reading",
      topic: d.title.trim().slice(0, 160),
      ...(d.meta.summary?.trim() ? { summary: d.meta.summary.trim() } : {}),
      ...(d.meta.sourceRef?.trim() ? { sourceRef: d.meta.sourceRef.trim() } : {}),
      // En prosa cada bloque se limpia; en verso se conservan los saltos de línea
      paragraphs: d.entries.flatMap((e) => (e.text?.trim() ? [verse ? e.text.trim() : e.text.replace(/\s+/g, " ").trim()] : [])),
      source: d.meta.sourceRef?.trim() ? "import" : "manual",
    });
    const pending = Number(created?.pending ?? 0);
    // [2026-10-27]: NestJS guarda las frases al instante y genera IPA + traducción en segundo plano (`enriching`) → aviso informativo, no un error
    const note = created?.enriching
      ? `Generando IPA y traducción de ${pending} frase(s) en segundo plano: aparecerán en el editor en unos instantes.`
      : `${pending} frase(s) quedaron sin IPA o traducción; complétalas desde el editor («Completar IPA y traducción»).`;
    return { id: idOf(created), warnings: pending ? [note] : [] };
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

// [LEVEL_FROM_TEXT · 2026-11-16 · RF-148]: tipos cuyo nivel, si no lo fija el tema, lo estima NestJS del texto al guardar (LevelClassifier)
export const LEVEL_FROM_TEXT: ReadonlySet<CreatableKind> = new Set<CreatableKind>(["reading", "dialogues"]);

// [validateDraft]: reglas comunes (título, mínimo de filas, obligatorios) + las del tipo
export function validateDraft(kind: CreatableKind, d: ActivityDraft, ctx: KindContext): string[] {
  const s = ACTIVITY_KINDS[kind];
  const p: string[] = [];
  if (kind !== "polyglot" && !ctx.language) p.push("Elige el idioma (paso 2).");
  if (kind !== "polyglot" && !ctx.level && !LEVEL_FROM_TEXT.has(kind)) p.push("Falta el nivel: elige un tema del catálogo (lo asigna) o, con un tema libre, elige el nivel en el paso 2.");
  const minTitle = kind === "practice" ? 3 : 2; // = MinLength de cada DTO de NestJS
  if (d.title.trim().length < minTitle) p.push(`Escribe un título (mín. ${minTitle} caracteres).`);
  const origin = draftOrigin(d);
  // [2026-10-27]: solo los campos que aplican al origen (los de derechos solo con texto importado)
  for (const f of s.meta) if (f.required && f.type !== "checkbox" && fieldApplies(f, origin, d.meta) && !d.meta[f.key]?.trim()) p.push(`Falta «${f.label}».`);
  if (d.entries.length < s.minEntries) p.push(`Añade al menos ${s.minEntries} ${s.entryLabel.toLowerCase()}${s.minEntries === 1 ? "" : "s"}.`);
  return [...p, ...s.validate(d, ctx)];
}
