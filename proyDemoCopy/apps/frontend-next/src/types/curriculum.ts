import type { Language, LanguageSkill } from "@/types/quiz";
import type { CefrLevel } from "@/types/courses";
// [Tipos de Recursos (curriculum)]: contrato frontend ↔ backend NestJS + metadatos de UI + contenido tipado por tipo | [Patrón]: Type Module + SSOT | [Principio]: DRY + SSOT | [Paradigma]: Tipado estructural (TS)

// `export type` (TS) con uniones de literales: tipos cerrados equivalentes a los enums del backend (se borran al compilar)
export type CurriculumItemKind =
  | "grammar_rule"
  | "vocabulary"
  | "example"
  | "translation"
  | "pronunciation"
  | "common_error"
  | "exercise"
  | "rubric";

export type Provenance = "manual" | "imported" | "generated" | "expert_validated";

// [Estados editoriales]: espejo del enum ReviewStatus del backend (Etapa 2 de la especificación MCER) | unión de literales (TS)
export type ReviewStatus = "draft" | "generated" | "review_required" | "reviewed" | "approved" | "archived";

// [Habilidad]: el backend usa las 7 competencias (sin "general"/"custom") | `Exclude<U, E>` (TS) quita miembros de una unión
export type CurriculumSkill = Exclude<LanguageSkill, "general" | "custom">;

// `export interface` (TS): forma del recurso devuelto por GET /curriculum
export interface CurriculumItem {
  id: string;
  key: string;
  kind: CurriculumItemKind;
  language: Language;
  level: CefrLevel;
  skill: CurriculumSkill;
  topic: string;
  content: Record<string, unknown>; // `Record<string, unknown>` (TS): objeto JSON con estructura según `kind` (ver ContentByKind)
  provenance: Provenance;
  reviewStatus: ReviewStatus;
  source: string | null;
  topicId: string | null; // Tema del catálogo (null en recursos anteriores)
  sourceId: string | null; // Fuente del catálogo
  reviewNote: string | null;
  flags?: string[]; // [Banderas de calidad]: p. ej. CONTRADICCION_DETECTADA (Etapa 4) | `?`: respuestas anteriores no la traen
  version: number; // Se envía como expectedVersion al editar (concurrencia optimista)
  createdAt: string;
  updatedAt: string;
}

export interface CurriculumRevision {
  id: string;
  version: number;
  changeType: "created" | "updated" | "status_changed";
  changedBy: string;
  note: string | null;
  createdAt: string;
}

// [Traza de una generación con IA]: espejo de CurriculumGeneration del backend | `null` = dato no informado por el proveedor (nunca estimado)
export interface GenerationFlags {
  requiresReview: boolean; // REQUIERE_REVISION
  reasons: string[];
  contradiction: "not_checked" | "none" | "detected"; // CONTRADICCION_DETECTADA
  reusable: boolean; // REUTILIZABLE
  llmRequired: boolean; // LLM_REQUIRED
}
export interface CurriculumGeneration {
  id: string;
  model: string;
  modelDigest: string | null;
  quantization: string | null;
  parameterSize: string | null;
  promptTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  loadMs: number | null;
  ramBytes: number | null;
  vramBytes: number | null;
  promptVersion: string;
  flags: GenerationFlags;
  content: Record<string, unknown>;
  createdAt: string;
}

// [Resultado de "Generar con IA"]: qué estrategia se usó (existente / caché / LLM) | `DraftStrategy` (TS union literal)
export type DraftStrategy = "existing" | "cache" | "llm";
// [DraftItem]: un elemento del lote generado, con su registro trazable
export interface DraftItem {
  content: Record<string, unknown>;
  generationId?: string;
}
export interface DraftResult {
  strategy: DraftStrategy;
  llmRequired: boolean;
  content: Record<string, unknown>; // Primer elemento (compatibilidad)
  drafts: DraftItem[]; // [Lote]: todos los elementos generados (`count` en la petición)
  generationId?: string;
  existingItemId?: string;
  trace?: CurriculumGeneration;
}

export interface CurriculumItemView {
  item: CurriculumItem & { generationId?: string | null };
  revisions?: CurriculumRevision[]; // `?` (TS): solo para docentes/admin
  generation?: CurriculumGeneration | null; // Traza IA (solo docentes/admin)
}

// [TopicGroup]: una tarjeta de /resources = tema + idioma + nivel (espejo del read model del backend)
export interface TopicGroup {
  topic: string;
  language: Language;
  level: CefrLevel;
  count: number;
  approved: number; // Publicados (aprobados) dentro del grupo
  kinds: CurriculumItemKind[];
  emoji: string | null;
}

// [groupQuery]: query string de un grupo (tema + idioma + nivel + tipo) para enlazar sus páginas | [Principio]: DRY
export const groupQuery = (g: { topic: string; language: string; level: string; kind?: string }): string =>
  new URLSearchParams(Object.entries(g).filter(([, v]) => v) as [string, string][]).toString();

export interface PaginatedCurriculum {
  data: CurriculumItem[];
  total: number;
  page: number;
  limit: number;
}

// ───────────────────── Metadatos de UI por tipo de recurso ─────────────────────
// [KindMeta]: qué ES cada tipo, explicado al autor → "Tipo" (qué creas) ya no se confunde con "Habilidad" (qué practica el estudiante)
// `skill.mode`: "fixed" = el tipo determina la habilidad (no se pregunta) · "suggested" = se preselecciona pero se puede cambiar
export interface KindMeta {
  label: string; // Nombre corto
  icon: string; // Emoji decorativo (aria-hidden en la UI)
  description: string; // Una línea: para qué sirve
  skill?: { value: CurriculumSkill; mode: "fixed" | "suggested" };
}

// `Readonly<Record<K, V>>` (TS): exhaustivo → si el backend añade un tipo, el compilador exige su metadata | [Patrón]: Lookup Table + SSOT
export const KIND_META: Readonly<Record<CurriculumItemKind, KindMeta>> = {
  vocabulary: { label: "Vocabulario", icon: "🔤", description: "Una palabra con traducción, pronunciación y ejemplos.", skill: { value: "vocabulary", mode: "fixed" } },
  grammar_rule: { label: "Regla gramatical", icon: "📐", description: "Explica una estructura con su fórmula y ejemplos.", skill: { value: "grammar", mode: "fixed" } },
  example: { label: "Frase de ejemplo", icon: "💬", description: "Una frase en el idioma con su traducción." },
  translation: { label: "Traducción", icon: "🔁", description: "Texto original y su traducción verificada.", skill: { value: "reading", mode: "suggested" } },
  pronunciation: { label: "Pronunciación", icon: "🗣️", description: "Cómo suena una palabra o frase (transcripción IPA).", skill: { value: "pronunciation", mode: "fixed" } },
  common_error: { label: "Error frecuente", icon: "⚠️", description: "Lo que se suele decir mal y cómo corregirlo.", skill: { value: "grammar", mode: "suggested" } },
  exercise: { label: "Ejercicio", icon: "✏️", description: "Pregunta con respuesta que se corrige automáticamente." },
  rubric: { label: "Rúbrica", icon: "📋", description: "Criterios para evaluar textos escritos u orales.", skill: { value: "writing", mode: "suggested" } },
};

// [Orden de presentación]: vocabulario primero (el más usado) | `Object.keys(...) as T[]` (TS): claves tipadas
export const KINDS = Object.keys(KIND_META) as CurriculumItemKind[];

// [RESOURCE_KINDS · 2026-10-23 · 4.º pase]: tipos que se OFRECEN en Recursos (chips y «¿Qué vas a crear?») — «Traducción» sale: traducir es una herramienta (menú «Traductor», estilo Google Translate)
// Los recursos de traducción ya guardados se siguen viendo en «Todos» y se pueden editar (KIND_META sigue siendo exhaustivo) | [Principio]: OCP (filtrar, no borrar el tipo del backend)
export const RESOURCE_KINDS: readonly CurriculumItemKind[] = KINDS.filter((k) => k !== "translation"); // Tipo ancho: `includes(k)` acepta cualquier tipo

// [KIND_LABEL]: derivada de KIND_META (compatibilidad con código existente) | `Object.fromEntries` (ES2019) | [Principio]: DRY
export const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k, KIND_META[k].label])) as Readonly<Record<CurriculumItemKind, string>>;

// [BACK_LABEL · 2026-10-24]: texto del enlace «Volver a …» según el TIPO del recurso abierto («Volver a vocabulario», «Volver a regla gramatical»…) | [Patrón]: Lookup Table
// [Principio]: DRY + SSOT — un solo mapa para todas las páginas de recursos (Gestión y estudiantes) | `Record<Kind, string>` exhaustivo: un tipo nuevo obliga a añadir su texto (TS)
export const BACK_LABEL: Readonly<Record<CurriculumItemKind, string>> = {
  vocabulary: "Volver a vocabulario",
  grammar_rule: "Volver a regla gramatical",
  example: "Volver a frase de ejemplo",
  translation: "Volver a traducción",
  pronunciation: "Volver a pronunciación",
  common_error: "Volver a error frecuente",
  exercise: "Volver a ejercicio",
  rubric: "Volver a rúbrica",
};
// [backLabel]: sin tipo conocido (p. ej. «Crear recurso» o un tema mixto) → texto genérico | `?` (TS): parámetro opcional
export const backLabel = (kind?: CurriculumItemKind): string => (kind ? BACK_LABEL[kind] : "Volver a recursos");

export const PROVENANCE_LABEL: Readonly<Record<Provenance, string>> = {
  manual: "Creado por el equipo",
  imported: "Tomado de una fuente externa",
  generated: "Generado por IA",
  expert_validated: "Validado por especialista",
};

// [Estados con nombres de uso]: "Publicado"/"Devuelto" dicen qué pasa, no el término interno
export const STATUS_LABEL: Readonly<Record<ReviewStatus, string>> = {
  draft: "Borrador",
  generated: "Generado por IA",
  review_required: "En revisión",
  reviewed: "Revisado",
  approved: "Publicado",
  archived: "Archivado",
};

// [Explicación de cada estado]: qué significa para el estudiante → el autor entiende el flujo sin manual (UX)
export const STATUS_HELP: Readonly<Record<ReviewStatus, string>> = {
  draft: "Solo lo ven docentes y administradores. Puedes editarlo con calma. Si te lo devolvieron, lee el comentario en el historial.",
  generated: "Creado por la IA y sin revisar: no es contenido verificado. Revísalo y envíalo a revisión.",
  review_required: "Esperando que un docente o administrador lo revise.",
  reviewed: "Un docente ya lo revisó. Falta que un administrador lo apruebe para publicarlo.",
  approved: "Visible para los estudiantes y usado por la plataforma.",
  archived: "Retirado: ya no se muestra ni se usa.",
};

// [Acción por transición]: verbo claro en lugar de "→ Estado" | `note`: si el comentario es obligatorio u opcional | `tone`: estilo del botón
type TransitionAction = { label: string; note?: "required" | "optional"; tone: "primary" | "outline" | "danger" };
const TRANSITION_ACTION: Readonly<Record<ReviewStatus, TransitionAction>> = {
  draft: { label: "Volver a borrador", tone: "outline" },
  generated: { label: "Marcar como generado", tone: "outline" }, // No se usa como destino: solo lo asigna el backend al crear desde IA
  review_required: { label: "Enviar a revisión", tone: "primary" },
  reviewed: { label: "Marcar como revisado", note: "optional", tone: "primary" },
  approved: { label: "Aprobar y publicar", note: "optional", tone: "primary" },
  archived: { label: "Archivar", tone: "outline" },
};
// [Devolución]: volver a borrador DESDE revisión = devolver al autor con comentario obligatorio (espejo de isReturn del backend)
const RETURN_ACTION: TransitionAction = { label: "Devolver con cambios", note: "required", tone: "danger" };
const IN_REVIEW: ReadonlyArray<ReviewStatus> = ["review_required", "reviewed"];

// [transitionAction]: acción según origen y destino | función pura | [Patrón]: Lookup Table + regla especial
export const transitionAction = (from: ReviewStatus, to: ReviewStatus): TransitionAction =>
  to === "draft" && IN_REVIEW.includes(from) ? RETURN_ACTION : TRANSITION_ACTION[to];

export const SKILL_LABEL: Readonly<Record<CurriculumSkill, string>> = {
  grammar: "Gramática",
  vocabulary: "Vocabulario",
  reading: "Comprensión lectora",
  listening: "Comprensión auditiva",
  writing: "Expresión escrita",
  speaking: "Expresión oral",
  pronunciation: "Pronunciación",
};

// [Transiciones]: espejo de la máquina de estados del backend, solo para mostrar botones válidos (el backend decide) | [Principio]: la UI no es la autoridad
export const STATUS_TRANSITIONS: Readonly<Record<ReviewStatus, ReadonlyArray<ReviewStatus>>> = {
  draft: ["review_required", "archived"],
  generated: ["review_required", "draft", "archived"],
  review_required: ["reviewed", "draft", "archived"],
  reviewed: ["approved", "draft", "review_required"],
  approved: ["archived", "draft"],
  archived: ["draft"],
};

// ───────────────────── Contenido tipado por tipo de recurso ─────────────────────
// [Espejo de curriculum-content.schema.ts del backend]: el formulario edita estos objetos con campos, nunca JSON a mano | [Principio]: Tipado seguro
export interface IpaValue {
  value: string; // Transcripción, p. ej. /ˈwɔːtə/
  variant: string; // Variante regional BCP-47, p. ej. en-GB (obligatoria si hay IPA)
  source?: string; // Diccionario de referencia
}
export interface ExampleValue {
  text: string; // Frase en el idioma
  translationEs: string; // Traducción al español
  romanization?: string; // Pinyin / transliteración
}
export interface GrammarRuleContent { title: string; explanationEs: string; structure?: string; examples: ExampleValue[] }
// `emoji` / `image` (data URL ≤ 256 px): apoyo visual de la ficha
export interface VocabularyContent { lemma: string; partOfSpeech?: string; gender?: string; translationEs: string; ipa?: IpaValue; romanization?: string; examples: ExampleValue[]; emoji?: string; image?: string }
export type ExampleContent = ExampleValue;
export interface TranslationContent { source: string; targetEs: string; notes?: string }
// `ruleEs` + `examples` (2026-10-23): regla fonética y frases que la aplican
// [2026-10-24]: ficha de FONEMA (p. ej. /ɒ/) → `phoneme` (símbolo), `articulationEs` (cómo se pronuncia), `ruleEs` (cuándo se usa), `words` (palabras de ejemplo) y `examples` (frases)
export interface PronunciationWord { text: string; ipa?: string; translationEs?: string }
export interface PronunciationContent { text: string; ipa: IpaValue; romanization?: string; audioRef?: string; phoneme?: string; ruleEs?: string; articulationEs?: string; words?: PronunciationWord[]; examples?: ExampleValue[] }
export interface CommonErrorContent { incorrect: string; correct: string; explanationEs: string; ruleKey?: string }
export type ExerciseType = "multiple_choice" | "true_false" | "fill_blank" | "open_answer";
export interface ExerciseContent { prompt: string; type: ExerciseType; options?: string[]; answerKey: string[]; explanationEs?: string; rubricKey?: string }
export interface RubricBand { points: number; descriptorEs: string }
export interface RubricCriterion { name: string; descriptorEs: string; maxPoints: number; bands: RubricBand[] }
export interface RubricContent { title: string; criteria: RubricCriterion[] }

// [Mapa tipo → forma]: `ContentByKind["vocabulary"]` = VocabularyContent | [Patrón]: Type-level Registry
export interface ContentByKind {
  grammar_rule: GrammarRuleContent;
  vocabulary: VocabularyContent;
  example: ExampleContent;
  translation: TranslationContent;
  pronunciation: PronunciationContent;
  common_error: CommonErrorContent;
  exercise: ExerciseContent;
  rubric: RubricContent;
}

export const EXERCISE_TYPE_LABEL: Readonly<Record<ExerciseType, string>> = {
  multiple_choice: "Opción múltiple",
  true_false: "Verdadero / falso",
  fill_blank: "Completar el espacio",
  open_answer: "Respuesta abierta",
};

// [Contenido vacío por tipo]: el formulario arranca en blanco (los ejemplos van como placeholder) | `{ [K in …]: … }` (TS mapped type) | [Patrón]: Prototype
export const EMPTY_CONTENT: { readonly [K in CurriculumItemKind]: ContentByKind[K] } = {
  grammar_rule: { title: "", explanationEs: "", structure: "", examples: [] },
  vocabulary: { lemma: "", partOfSpeech: "", gender: "", translationEs: "", romanization: "", examples: [] },
  example: { text: "", translationEs: "", romanization: "" },
  translation: { source: "", targetEs: "", notes: "" },
  pronunciation: { text: "", ipa: { value: "", variant: "", source: "" }, romanization: "", phoneme: "", ruleEs: "", articulationEs: "", words: [], examples: [] },
  common_error: { incorrect: "", correct: "", explanationEs: "", ruleKey: "" },
  exercise: { prompt: "", type: "multiple_choice", options: ["", ""], answerKey: [], explanationEs: "" },
  rubric: { title: "", criteria: [{ name: "", descriptorEs: "", maxPoints: 5, bands: [] }] },
};

// [compactContent]: quita textos vacíos, objetos vacíos y filas vacías antes de enviar → el backend no recibe "" en campos opcionales | [Paradigma]: Funcional (recursiva y pura)
export function compactContent(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(compactContent).filter((v) => v !== undefined); // `filter` (ES5): descarta filas vacías
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => [k, compactContent(v)] as const) // `as const` (TS): tupla [clave, valor]
      .filter(([, v]) => v !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined; // Objeto sin datos → se omite
  }
  if (typeof value === "string") return value.trim() === "" ? undefined : value.trim();
  return value; // number / boolean tal cual
}

// [Catálogo de temas]: filtrado por idioma + nivel + habilidad (+ tipo opcional)
export interface CurriculumTopic {
  id: string;
  name: string;
  slug: string;
  language: Language;
  level: CefrLevel;
  skill: CurriculumSkill;
  kind: CurriculumItemKind | null;
  parentId: string | null;
}

// [Catálogo de fuentes]: registradas una vez y reutilizadas por los recursos
export interface CurriculumSource {
  id: string;
  name: string;
  slug: string;
  type: string | null;
  author: string | null;
  publisher: string | null;
  url: string | null;
  license: string | null;
  language: string | null;
  attribution: string;
  isOwnContent: boolean;
}

export interface KeyCheckResult {
  available: boolean;
  conflict?: { id: string; topic: string };
}

// ───── Etapa 4 · Comparación entre fuentes (espejo de source-comparison.ts del backend) ─────
export const CONTRADICTION_FLAG = "CONTRADICCION_DETECTADA";
// [Resultado del escaneo]: lo que devuelve POST /curriculum/contradictions/scan
export interface ScanResult {
  scanned: number;
  flagged: number;
  cleared: number;
  contradictions: Array<{ kind: CurriculumItemKind; headline: string; field: string; items: Array<{ id: string; key: string; origin: string; value: string }> }>;
}

// ───── Etapa 3 · Estructura del curso (espejo de course-outline.ts del backend) ─────
export type CourseNodeType = "level" | "module" | "unit" | "lesson";
// [Nodo del árbol]: lecciones con sus recursos, si están vacías (gap) y si el usuario ya las completó
export interface OutlineNode {
  id: string;
  type: CourseNodeType;
  title: string;
  level: CefrLevel;
  topic: string | null;
  kind: CurriculumItemKind | null;
  skill: CurriculumSkill | null;
  items?: Array<{ id: string; key: string; kind: CurriculumItemKind; reviewStatus: ReviewStatus }>;
  gap?: boolean;
  completed?: boolean;
  children: OutlineNode[];
}
export interface CourseOutline {
  courseId: string;
  levels: OutlineNode[];
  summary: { lessons: number; gaps: number; completed: number; nextLessonId: string | null };
}
// [Lección]: contenido completo para estudiar + navegación de la línea de tiempo
export interface LessonView {
  lesson: OutlineNode;
  items: CurriculumItem[];
  path: string[];
  position: { index: number; total: number };
  prevLessonId: string | null;
  nextLessonId: string | null;
}
// [Esquema editable]: lo que envía el editor (id = nodo existente → conserva el progreso)
export interface OutlineLessonInput { id?: string; title: string; topic: string; kind: CurriculumItemKind; skill: CurriculumSkill }
export interface OutlineUnitInput { id?: string; title: string; lessons: OutlineLessonInput[] }
export interface OutlineModuleInput { id?: string; title: string; units: OutlineUnitInput[] }
export interface OutlineLevelInput { id?: string; level: CefrLevel; title?: string; modules: OutlineModuleInput[] }

// ───── Etapa 5 · Certificaciones (espejo de certifications.ts) ─────
export interface Certification {
  id: string;
  name: string;
  language: Language;
  issuer: string;
  levels: Array<{ cefr: CefrLevel; exam: string }>;
  skills: CurriculumSkill[];
  cefrMapping: "official" | "approximate";
  url: string | null;
}
export interface CertificationPractice {
  strategy: "existing" | "cache" | "llm";
  drafts: Array<{ content: Record<string, unknown>; generationId?: string }>;
  generationId?: string;
  certification: Pick<Certification, "id" | "name" | "issuer" | "cefrMapping" | "url">;
  exam: string;
  topic: string;
  notice: string;
}
