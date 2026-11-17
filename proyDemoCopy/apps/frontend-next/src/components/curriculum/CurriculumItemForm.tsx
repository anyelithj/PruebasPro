"use client";
// `"use client"` (Next.js): este componente se hidrata en el navegador porque tiene estado e interacción
import { FileUp, PenLine, Recycle, Search, Sparkles, Trash2 } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { KindIcon } from "@/components/shared/KindIcon"; // [2026-10-23]: iconos SVG uniformes por tipo de recurso
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/slug"; // [Helper]: mismo algoritmo de slug que el backend
import { LANGUAGES, LEVEL_OPTIONS } from "@/lib/languages";
import { fmt, plural } from "@aula/shared-i18n";
import { useDebounce } from "@/hooks/useDebounce";
import { usePreferences } from "@/components/layout/PreferencesProvider"; // [i18n]: textos del modal de resultado
import { SearchSelect, type SearchOption } from "@/components/curriculum/SearchSelect";
import { SourceCreatePanel } from "@/components/curriculum/CatalogCreatePanels";
import { ContentEditor, missingFields } from "@/components/curriculum/ContentEditor";
import { ResourcePreview } from "@/components/curriculum/ResourcePreview";
import { GenerationTrace } from "@/components/curriculum/GenerationTrace";
import { ResultDialog, type SaveResult } from "@/components/shared/ResultDialog"; // [Modal]: "se creó con éxito" / error
import { curatedTopicsAllLevels, textLevel, topicLevel } from "@/config/curriculum-topics";
import { findPhoneme } from "@/config/ipa-chart"; // [2026-10-23 · 4.º pase]: regla del fonema elegido como tema de Pronunciación
import { ImportPanel } from "@/components/curriculum/ImportPanel"; // [Importar]: Excel, Word, PDF, texto o imagen → elementos editables // [Catálogo curado]: temas por tipo × idioma × nivel (SSOT, sin IA)
import Link from "next/link";
import { deleteResourceAction } from "@/app/(portal)/admin/curriculum/actions"; // [2026-11-13]: eliminar un elemento existente del tema
import {
  EMPTY_CONTENT,
  KIND_META,
  KINDS,
  RESOURCE_KINDS,
  PROVENANCE_LABEL,
  SKILL_LABEL,
  compactContent,
  type ContentByKind,
  type CurriculumItem,
  type CurriculumItemKind,
  type CurriculumSkill,
  type CurriculumSource,
  type DraftResult,
  groupQuery,
  type KeyCheckResult,
  type Provenance,
} from "@/types/curriculum";
import type { CefrLevel } from "@/types/courses";
import type { Language } from "@/types/quiz";
import { TopicSelect, topicGroups, useCatalogTopics } from "@/components/curriculum/TopicSelect"; // [2026-10-27 · DRY]: mismo campo «Tema» que «Crear actividad»
import { mapLimit } from "@/lib/map-limit"; // [2026-10-27 · Rendimiento]: guardado de varios elementos en paralelo acotado
import { TopicTitle } from "@/components/language/TopicTitle"; // [2026-10-19]: tema en el idioma estudiado con IPA, audio y traducción
// [Organismo CurriculumItemForm]: crear/editar recursos en 4 pasos — idioma y nivel · tipo · tema (lista) · contenido (uno o VARIOS elementos, con IA o a mano) | [Patrón]: Wizard ligero + Controlled Components + Strategy (editor por tipo) | [Principio]: SRP + DRY + KISS | [Paradigma]: Funcional + Reactivo
// [UX]: el tema se ELIGE de una lista (temario + sugerencias de IA en grupos separados); "Otro tema" permite escribir uno nuevo; al guardar aparece un modal de éxito/error

// [Niveles con nombre · 2026-10-24]: SSOT en lib/languages (LEVEL_OPTIONS) → lo comparten «Crear recurso» y «Crear actividad»
const LEVELS = LEVEL_OPTIONS;
const SKILLS = Object.keys(SKILL_LABEL) as CurriculumSkill[];
const PROVENANCES: ReadonlyArray<Provenance> = ["manual", "imported", "generated", "expert_validated"];
// [Lote de IA = 3]: 10 elementos tardaban ~6,5 min en CPU (francés A1, 2026-10-19) y el fetch del BFF de Next.js corta a los 300 s (headersTimeout de undici)
// → «El servidor no responde». Con 3 por llamada cada lote tarda ~2 min, la barra de progreso avanza y un fallo solo pierde un lote | ≤ MAX_BATCH del backend
const AI_BATCH = 3;
// [Fix 2026-11-13 · 504 en /api/curriculum/ai/content]: fichas largas (pronunciación, regla gramatical, rúbrica: 650–800 tokens c/u) en lotes de 3 → ~2700 tokens
// en CPU superaban los 5 min de una petición → 504. Esos tipos van de 1 en 1 (cada lote cabe en el plazo y el progreso avanza) | [Patrón]: Lookup Table
const HEAVY_KINDS = new Set<CurriculumItemKind>(["pronunciation", "grammar_rule", "rubric"]);
const batchFor = (kind: CurriculumItemKind) => (HEAVY_KINDS.has(kind) ? 1 : AI_BATCH);
const RETRIES = 6; // [2026-10-23]: reintentos ante 429 (6 × 15 s ≈ más que la ventana de 60 s del throttler)
const RETRY_WAIT_S = 15;
const DRY_LIMIT = 2; // [Fix 2026-10-28]: rondas SEGUIDAS sin elementos nuevos antes de rendirse (cada ronda ≈ 1–2 min en CPU)
const SAVE_PARALLEL = 3; // [2026-10-27]: recursos guardados a la vez (cada alta es solo BD: validación + transacción) — bajo para no agotar el throttler de NestJS

type SourceOption = CurriculumSource & SearchOption;
const toSourceOption = (s: CurriculumSource): SourceOption => ({ ...s, label: s.name, hint: s.license ?? undefined });

// [Elemento del lote]: contenido editable + id local estable (key de React) + generación de IA enlazada
interface Entry {
  uid: string;
  content: Record<string, unknown>;
  generationId?: string;
  itemId?: string; // Recurso ya guardado (edición) → PATCH en vez de POST
  version?: number; // Versión para la concurrencia optimista
  key?: string; // Clave natural ya asignada (no cambia al editar)
  dirty?: boolean; // Modificado en el formulario → se guarda; sin cambios → se omite
}

// [Contenido inicial]: plantilla vacía del tipo + lo que ya tenga el recurso | `...` spread (ES2018)
const initialContent = (kind: CurriculumItemKind, existing?: Record<string, unknown>): Record<string, unknown> => ({
  ...(EMPTY_CONTENT[kind] as unknown as Record<string, unknown>),
  ...(existing ?? {}),
});
// [newEntry]: Factory de elementos | `crypto.randomUUID` (Web Crypto API): id único
const newEntry = (kind: CurriculumItemKind, content?: Record<string, unknown>, generationId?: string): Entry => ({ uid: crypto.randomUUID(), content: initialContent(kind, content), generationId });

// [headline]: texto principal de un elemento → clave única cuando se crean varios del mismo tema | `find` + type guard (TS)
const headline = (c: Record<string, unknown>): string => [c.lemma, c.text, c.title, c.source, c.incorrect, c.prompt].find((v): v is string => typeof v === "string" && v.trim() !== "") ?? "";

export interface CurriculumItemFormProps {
  initial?: CurriculumItem; // Presente ⇒ modo edición de UN recurso
  initialGroup?: CurriculumItem[]; // Presente ⇒ modo TEMA: edita todos los elementos del tema y permite añadir más
  canAdmin?: boolean; // Habilita "+ Registrar fuente" (el backend exige ADMIN igualmente)
  ownSource?: CurriculumSource | null; // Fuente "Contenido propio" precargada en el servidor
  initialSource?: CurriculumSource | null; // Fuente actual del recurso en edición
}

// [Step]: tarjeta numerada | [Patrón]: Composite | [Principio]: DRY
// `disabled`: <fieldset disabled> (HTML) desactiva todos sus controles de una vez → modo tema (idioma, nivel y tema fijos)
// `invalid`: borde rojo del paso cuando falta algo obligatorio tras intentar guardar (el mensaje dice qué)
export function Step({ n, title, hint, children, disabled = false, invalid = false }: { n: number; title: string; hint?: string; children: React.ReactNode; disabled?: boolean; invalid?: boolean }) {
  return (
    <section className={cn("surface space-y-4 p-5", invalid && "border-destructive ring-1 ring-destructive/40")} aria-labelledby={`step-${n}`} aria-invalid={invalid || undefined}>
      <header>
        <h2 id={`step-${n}`} className="title-section flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-full bg-gradient-brand text-xs text-white" aria-hidden>
            {n}
          </span>
          {title}
        </h2>
        {hint && <p className="mt-1 type-meta text-muted-foreground">{hint}</p>}
      </header>
      {/* `display: contents`: el fieldset no altera el layout; solo aporta `disabled` */}
      <fieldset disabled={disabled} className="contents">
        {children}
      </fieldset>
    </section>
  );
}

// [SelectField]: label + <select> nativo (accesible y sin librerías) | `<T extends string>` (TS Generics)
// `invalid` → aria-invalid: `.control` pinta el borde en rojo (globals.css) y el lector de pantalla anuncia el error
function SelectField<T extends string>({ id, label, value, onChange, placeholder, options, hint, invalid = false, disabled = false }: { id: string; label: string; value: T | ""; onChange: (v: T | "") => void; placeholder: string; options: ReadonlyArray<{ value: T; label: string }>; hint?: string; invalid?: boolean; disabled?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-muted-foreground">
        {label} <span className="req" aria-hidden>*</span>
      </label>
      <select id={id} required value={value} onChange={(e) => onChange(e.target.value as T | "")} disabled={disabled} className="control w-full disabled:cursor-not-allowed disabled:opacity-70" aria-invalid={invalid || undefined} aria-describedby={hint ? `${id}-hint` : undefined}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 type-meta text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

// [CountInput · 2026-10-23 · 4.º pase]: cantidad de elementos a crear (mínimo 1, sin máximo) como STEPPER «− [n] +» — etiqueta ENCIMA del campo
// (antes iba en línea con el número y desalineaba la fila) | <input type="number"> nativo (HTML) + botones | [Principio]: DRY (se usa en "elegir" y en "generar más")
// [A11y]: el <input> sigue siendo editable con teclado (flechas ↑/↓ nativas); los botones llevan aria-label y aria-controls
// [2026-10-24 · Vaciar al enfocar]: `select()` en onFocus no bastaba (Chrome/Safari deshacen la selección al soltar el clic) → al enfocar el campo se VACÍA y el número
// actual queda como `placeholder`; al salir sin escribir (o con un valor inválido) se restaura | [Patrón]: Controlled Component + borrador local (draft) | [Paradigma]: Reactivo
// [Altura · 2026-10-24]: el contenedor mide `h-10` (40 px, borde incluido por `box-sizing: border-box`) = misma altura que `.control` y `.btn` del formulario
// [2026-10-24 · export + `label`/`max` opcionales]: lo reutiliza «Crear actividad» («¿Cuántos ítems?», máx. del DTO); sin ellos se comporta igual que antes
export function CountInput({ id, value, onChange, label = "¿Cuántos elementos?", max }: { id: string; value: number; onChange: (n: number) => void; label?: string; max?: number }) {
  const set = (n: number) => onChange(Math.min(max ?? Infinity, Math.max(1, Math.trunc(n)))); // `?? Infinity`: sin `max` no hay tope // `Math.trunc/max`: entero ≥ 1 (0 o negativos no tienen sentido)
  // `useState<string | null>` (React + TS union): null = sin editar (muestra `value`) · string = lo que el usuario está escribiendo (puede estar vacío)
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-muted-foreground">
        {label}
      </label>
      <div className="inline-flex h-10 items-stretch overflow-hidden rounded-lg border border-border bg-muted focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/40">
        <button type="button" aria-label="Uno menos" aria-controls={id} disabled={value <= 1} onClick={() => set(value - 1)} className="grid w-10 place-items-center text-lg font-bold text-muted-foreground hover:bg-card hover:text-primary disabled:opacity-40">
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric" // Teclado numérico en móvil
          min={1}
          max={max}
          value={draft ?? value} // `??` (ES2020): sin borrador → el valor confirmado
          placeholder={String(value)} // El valor anterior se ve atenuado mientras el campo está vacío
          onFocus={() => setDraft("")} // [Vaciar al enfocar]: se escribe el número real sin borrar el de por defecto
          // `valueAsNumber` (DOM): NaN si el campo está vacío → solo se confirma un entero ≥ 1; el texto se conserva en el borrador
          onChange={(e) => {
            setDraft(e.target.value);
            if (e.target.valueAsNumber >= 1) set(e.target.valueAsNumber);
          }}
          onBlur={() => setDraft(null)} // [Restaurar]: vacío o inválido → vuelve a mostrar el último valor válido
          className="no-spin h-full w-16 border-x border-border bg-transparent text-center text-sm font-semibold tabular-nums text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
        <button type="button" aria-label="Uno más" aria-controls={id} disabled={max !== undefined && value >= max} onClick={() => set(value + 1)} className="grid w-10 place-items-center text-lg font-bold text-muted-foreground hover:bg-card hover:text-primary disabled:opacity-40">
          +
        </button>
      </div>
    </div>
  );
}

// [ChoiceCard · 2026-10-23 · 4.º pase]: tarjeta de una forma de crear el contenido (título + explicación + acción abajo) | [Patrón]: Composite | [Principio]: DRY
// Las tres tarjetas (IA · a mano · importar) tienen la MISMA estructura → la acción queda alineada al pie (`mt-auto`) aunque los textos midan distinto
export function ChoiceCard({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 surface-item">
      <header className="space-y-1">
        <h3 className="title-card flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-tone-brand-soft text-tone-brand" aria-hidden>
            {icon}
          </span>
          {title}
        </h3>
        <p className="type-meta text-muted-foreground">{hint}</p>
      </header>
      <div className="mt-auto space-y-2">{children}</div>
    </section>
  );
}

export function CurriculumItemForm({ initial, initialGroup, canAdmin = false, ownSource = null, initialSource = null }: CurriculumItemFormProps) {
  const router = useRouter();
  const { t, locale } = usePreferences();
  const rt = t.common.result;
  const isEdit = Boolean(initial);
  const isGroup = Boolean(initialGroup?.length); // [Modo tema]: idioma, nivel, tipo y tema fijos; se editan/añaden elementos
  const locked = isEdit || isGroup; // Tipo e idioma no cambian sobre contenido existente
  const first = initial ?? initialGroup?.[0]; // Valores por defecto de los pasos 1–3

  // ───── Estado ─────
  const [language, setLanguage] = useState<Language | "">(first?.language ?? "");
  const [level, setLevel] = useState<CefrLevel | "">(first?.level ?? "");
  const [kind, setKind] = useState<CurriculumItemKind>(first?.kind ?? "vocabulary");
  const [skill, setSkill] = useState<CurriculumSkill | "">(first?.skill ?? KIND_META.vocabulary.skill?.value ?? "");
  const [topicName, setTopicName] = useState(first?.topic ?? "");
  const [customTopic, setCustomTopic] = useState(false); // true = "Otro tema": se escribe en un campo de texto
  const [manualKey, setManualKey] = useState<string | null>(null); // null = clave derivada del tema
  const [provenance, setProvenance] = useState<Provenance>(first?.provenance ?? "manual");
  const [source, setSource] = useState<SourceOption | null>(initialSource ? toSourceOption(initialSource) : !initial && ownSource ? toSourceOption(ownSource) : null);
  // [Elementos]: en edición siempre uno; en alta, tantos como el autor quiera
  const [entries, setEntries] = useState<Entry[]>(() =>
    initial
      ? [{ uid: initial.id, content: initialContent(initial.kind, initial.content), itemId: initial.id, version: initial.version, dirty: true }]
      : (initialGroup ?? []).map((it) => ({ uid: it.id, content: initialContent(it.kind, it.content), itemId: it.id, version: it.version, key: it.key, dirty: false })),
  );
  const [count, setCount] = useState(1); // Cantidad a generar/añadir
  // [Modo del contenido]: "choose" = aún no eligió cómo crearlo · "fields" = editar campos
  const [contentMode, setContentMode] = useState<"choose" | "fields">(locked ? "fields" : "choose");
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const [keyCheck, setKeyCheck] = useState<{ input: string; message: string | null }>({ input: "", message: null });
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null); // [2026-10-23]: aviso de espera por límite de envíos
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [aiTopics, setAiTopics] = useState<{ key: string; list: string[] }>({ key: "", list: [] });
  const [aiBusy, setAiBusy] = useState<"topics" | "content" | null>(null);
  const [aiProgress, setAiProgress] = useState<{ done: number; total: number } | null>(null); // Avance de la generación por lotes
  const [aiError, setAiError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null); // Último resultado de IA (estrategia + traza)
  const [result, setResult] = useState<SaveResult | null>(null); // [Modal de resultado]: null = cerrado
  const [doneHref, setDoneHref] = useState<string | null>(null); // Destino tras cerrar el modal de éxito

  const meta = KIND_META[kind];
  const skillFixed = meta.skill?.mode === "fixed";
  // [Nivel auto · 2026-11-16]: al CREAR el nivel lo fija el tema (bloqueado) · editable al editar · tema libre sin nivel detectable → se elige a mano
  const autoLevel = topicName.trim().length >= 2 ? (topicLevel(topicName, language) ?? textLevel(topicName, language)) : null;
  const levelLocked = !locked && !(customTopic && !autoLevel);
  const comboReady = Boolean(language && level && skill);
  const comboKey = comboReady ? `${language}|${level}|${skill}|${kind}` : "";
  const languageLabel = LANGUAGES.find((l) => l.value === language)?.label ?? "";
  const phoneme = kind === "pronunciation" && language ? findPhoneme(language, topicName) : null; // [2026-10-23 · 4.º pase]: null si el tema no es un fonema

  // ───── Temas del temario (opciones del select) ─────
  // [2026-10-27 · DRY]: hook y <select> extraídos a TopicSelect → «Crear actividad» usa EXACTAMENTE la misma lista de temas
  const catalog = useCatalogTopics({ language, level, skill, kind });
  const suggested = aiTopics.key === comboKey ? aiTopics.list : [];
  // [Grupos de la lista]: 1) catálogo curado (tipo × idioma × nivel) · 2) temario guardado en BD que no esté ya · 3) sugerencias de IA nuevas
  // [2026-11-09]: temas de TODOS los niveles (primero el elegido) → elegir el tema asigna el nivel
  const curated = language ? curatedTopicsAllLevels(kind, language, level) : [];
  const groups = topicGroups(curated, catalog, [{ label: "Sugeridos por la IA", topics: suggested }]);
  const aiTopicsFresh = groups.find((g) => g.label === "Sugeridos por la IA")?.topics ?? []; // Solo las sugerencias que no estaban ya
  // [Tema del catálogo]: si el texto coincide con un tema existente se enlaza por id | `localeCompare` sensitivity "base": ignora mayúsculas/tildes
  const catalogTopic = catalog.find((x) => x.name.localeCompare(topicName.trim(), "es", { sensitivity: "base" }) === 0) ?? null;
  const key = manualKey?.trim() || catalogTopic?.slug || (initial && initial.topic === topicName ? initial.key : slugify(topicName)); // Clave natural derivada
  const usesOwnSource = provenance !== "imported";

  // [Clave por elemento]: uno → la del tema; varios → tema + texto principal (única por elemento) | máx. 120 (DTO del backend)
  const entryKey = (entry: Entry, i: number) =>
    isEdit || (!isGroup && entries.length === 1) ? key : entry.key ? entry.key : slugify(`${topicName} ${headline(entry.content) || i + 1}`).slice(0, 120).replace(/-+$/, "") || `${key}-${i + 1}`;

  // [Reinicio del contenido]: al cambiar idioma o tipo lo escrito deja de valer (evita el "revuelto" de idiomas)
  const resetContent = () => {
    setEntries([]);
    setContentMode("choose");
    setDraft(null);
  };

  const onLanguageChange = (next: Language | "") => {
    setLanguage(next);
    if (!locked) resetContent();
  };

  // [Cambio de tipo]: habilidad deducida/sugerida + plantilla vacía | [Patrón]: Strategy
  const onKindChange = (next: CurriculumItemKind) => {
    if (next === kind) return;
    setKind(next);
    const s = KIND_META[next].skill;
    if (s && (s.mode === "fixed" || !skill)) setSkill(s.value);
    resetContent();
  };

  // [Tema desde el select]: "Otro tema" abre el campo de texto; cualquier otra opción fija el tema
  const onTopicSelect = (value: string, custom: boolean) => {
    setCustomTopic(custom);
    setTopicName(value);
  };

  const onProvenanceChange = (next: Provenance) => {
    setProvenance(next);
    if (next !== "imported") setSource(ownSource ? toSourceOption(ownSource) : null);
    else if (source?.isOwnContent) setSource(null);
  };

  // [Comprobación de clave duplicada]: solo con un elemento (con varios la clave incluye el texto de cada uno); el backend vuelve a validar
  const titleTopic = useDebounce(topicName, customTopic ? 700 : 0); // Tema escrito a mano → se traduce al dejar de teclear
  const keyCheckInput = useDebounce(language && key && !isGroup && entries.length <= 1 ? `${language}|${kind}|${key}` : "", 400);
  const keyConflict = keyCheckInput !== "" && keyCheck.input === keyCheckInput ? keyCheck.message : null;
  useEffect(() => {
    if (!keyCheckInput) return;
    const [lang = "", knd = "", k = ""] = keyCheckInput.split("|");
    const controller = new AbortController();
    const qs = new URLSearchParams({ language: lang, kind: knd, key: k, ...(initial ? { excludeId: initial.id } : {}) });
    fetch(`/api/curriculum/key-check?${qs}`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<KeyCheckResult>) : null))
      .then((res) => res && setKeyCheck({ input: keyCheckInput, message: res.available ? null : `Ya existe un recurso de este tipo para el tema «${res.conflict?.topic}». Elige otro tema o crea varios elementos.` }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [keyCheckInput, initial]);

  const fetchSources = useCallback(async (q: string, signal: AbortSignal): Promise<SourceOption[]> => {
    const qs = new URLSearchParams({ limit: "20", ...(q ? { search: q } : {}) });
    const res = await fetch(`/api/curriculum/sources?${qs}`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return ((await res.json()) as CurriculumSource[]).filter((s) => !s.isOwnContent).map(toSourceOption);
  }, []);

  // ───── IA ─────
  // [Fix 2026-10-28]: `status` en el error (opcional) → la generación por rondas distingue «ronda sin elementos nuevos» (422) de un fallo real (red, 5xx)
  const postAi = async <T,>(action: "topics" | "content", body: Record<string, unknown>, onError?: (status: number, message: string) => void): Promise<T | null> => {
    setAiBusy(action);
    setAiError(null);
    try {
      const res = await fetch(`/api/curriculum/ai/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as T & { message?: string }; // `.catch`: un 502/504 con HTML no rompe con SyntaxError
      if (!res.ok) {
        const message = data.message ?? `HTTP ${res.status}`;
        setAiError(message);
        onError?.(res.status, message); // `?.()` (ES2020): solo si quien llama quiere el detalle
        return null;
      }
      return data;
    } catch {
      setAiError("No se pudo conectar con el servidor.");
      onError?.(0, "No se pudo conectar con el servidor.");
      return null;
    } finally {
      setAiBusy(null);
    }
  };

  // [Sugerir temas]: la IA devuelve temas NUEVOS acordes a idioma, nivel, tipo y habilidad → se añaden a la lista (grupo propio)
  const suggestTopics = async () => {
    const data = await postAi<{ topics: string[] }>("topics", { language, level, skill, kind });
    if (data) setAiTopics({ key: comboKey, list: [...new Set([...suggested, ...data.topics])] }); // Acumula sin duplicados
  };

  // [Generar con IA]: `count` elementos en lotes de AI_BATCH (el modelo local no admite más por llamada); `append` = añadir a los que ya hay
  // [Patrón]: Batch Processing secuencial · el backend aplica existente → caché → LLM en cada lote
  const generateContent = async ({ force = false, append = false } = {}) => {
    const total = count;
    const created: Entry[] = [];
    const seen = new Set(append ? entries.map((e) => slugify(headline(e.content))) : []); // [Sin duplicados entre lotes]: `Set` (ES2015)
    let last: DraftResult | null = null;
    // [Hasta completar · 2026-10-23]: antes el bucle avanzaba AI_BATCH aunque un lote trajera menos (repetidos o inválidos) → se creaban menos de los pedidos.
    // Ahora se pide lo que FALTA hasta llegar a `total`, con un tope de rondas para no quedar en bucle si la IA ya no tiene más ideas
    // [Fix 2026-10-28 · «La IA creó 4 de 16» + 422]: una ronda en la que la IA solo repitió lo existente (o devolvió JSON inválido) responde 422 y ANTES cortaba toda la
    // generación → ahora es una «ronda seca»: se reintenta (force + exclusiones) y solo se para tras DRY_LIMIT rondas secas SEGUIDAS; un fallo real (red, 5xx, 400) sí corta
    // [Patrón]: Batch Processing + Retry acotado | [Principio]: Fail Soft (se conserva lo generado) + Fail Fast ante errores no recuperables
    const batch = batchFor(kind);
    const maxRounds = Math.ceil(total / batch) + 4;
    let dry = 0; // Rondas seguidas sin elementos nuevos
    let lastFailure: { status: number; message: string } | null = null;
    for (let round = 0; created.length < total && round < maxRounds && dry < DRY_LIMIT; round++) {
      const done = created.length;
      setAiProgress({ done, total });
      // Lotes 2…n: `force` → la caché no devuelve el mismo lote otra vez
      // [exclude]: lo que ya hay en el formulario + lo generado en lotes anteriores → la IA propone elementos NUEVOS (el backend añade lo ya guardado del tema)
      // [Fix 2026-10-28]: cada titular ≤ 160 caracteres (@MaxLength del DTO; una traducción o enunciado largo daba 400) y los MÁS RECIENTES al final (el backend los prioriza en el prompt)
      const exclude = [...entries.map((e) => headline(e.content)), ...created.map((e) => headline(e.content))]
        .filter(Boolean)
        .map((h) => h.slice(0, 160))
        .slice(-200); // `slice(-200)` (JS): @ArrayMaxSize(200) conservando los últimos
      lastFailure = null;
      const data = await postAi<DraftResult>("content", { kind, language, level, skill, topic: topicName.trim(), force: force || round > 0, count: Math.min(batch, total - done), exclude }, (status, message) => {
        lastFailure = { status, message };
      });
      if (!data) {
        // `as` (TS): el callback asigna dentro de un closure → el análisis de flujo no lo ve
        const failure = lastFailure as { status: number; message: string } | null;
        // [Fix 2026-10-30]: 503/504 también cuentan como ronda seca → la IA en CPU puede agotar el plazo en un lote suelto y antes eso tiraba por la borda el resto de la cantidad pedida
        if (failure && [422, 503, 504].includes(failure.status)) {
          dry++;
          continue; // Ronda seca: se vuelve a pedir con más variedad (el backend sube la temperatura y lista lo repetido)
        }
        break; // Error no recuperable: ya mostrado en aiError; se conserva lo generado hasta aquí
      }
      last = data;
      if (data.strategy === "existing") break; // [No duplicar]: se ofrece abrir el recurso existente
      const before = created.length;
      for (const d of data.drafts ?? [{ content: data.content, generationId: data.generationId }]) {
        const h = slugify(headline(d.content));
        // ponytail: lotes independientes pueden repetir elementos → se descartan por titular; puede quedar alguno menos que lo pedido
        if (h && seen.has(h)) continue;
        seen.add(h);
        created.push(newEntry(kind, d.content, d.generationId));
      }
      dry = created.length > before ? 0 : dry + 1; // Lote que solo trajo repetidos también cuenta como seco
    }
    setAiProgress(null);
    setDraft(last);
    // [Aviso]: la IA no encontró suficientes elementos nuevos → se dice cuántos faltan (no se ocultan)
    // [Fix 2026-10-28]: el aviso parcial dice cuántas rondas se intentaron → queda claro que no fue un fallo silencioso
    if (created.length && created.length < total && last?.strategy !== "existing") setAiError(`La IA creó ${created.length} de ${total}: tras varios intentos no encontró más elementos nuevos sobre este tema (sin repetir los existentes). Revisa los creados, añade los que faltan a mano o pulsa «Generar más» con un tema más amplio.`);
    if (!created.length) return;
    setEntries((prev) => (append ? [...prev, ...created] : created));
    setContentMode("fields");
    onProvenanceChange("generated"); // [Transparencia]: queda registrado que lo propuso la IA
  };

  // [Escribir a mano]: `count` elementos vacíos (o añade uno más en modo campos)
  const addManual = (n: number) => {
    setEntries((prev) => [...prev, ...Array.from({ length: n }, () => newEntry(kind))]); // `Array.from({length})` (ES2015)
    setContentMode("fields");
  };

  // [Importar archivo]: los elementos leídos se AÑADEN al formulario para revisarlos antes de guardar
  const addImported = (contents: Record<string, unknown>[], sourceName = "") => {
    // [Valores por defecto · 2026-11-03]: con idioma y nivel ya elegidos, lo importado rellena lo que falte → «Qué practica» (la del tipo) y el tema (título del archivo/página)
    if (!skill) setSkill(meta.skill?.value ?? SKILLS[0]!);
    const name = sourceName.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_-]+/g, " ").trim(); // «partes-del-cuerpo.pdf» → «partes del cuerpo»
    if (!topicName.trim() && name.length >= 2) { setTopicName(name.slice(0, 120)); setCustomTopic(true); }
    setEntries((prev) => [...prev, ...contents.map((c) => newEntry(kind, c))]);
    setContentMode("fields");
  };

  const updateEntry = (uid: string, content: Record<string, unknown>) => setEntries((prev) => prev.map((e) => (e.uid === uid ? { ...e, content, dirty: true } : e))); // `dirty`: solo se guarda lo modificado
  const removeEntry = (uid: string) => {
    const next = entries.filter((e) => e.uid !== uid);
    setEntries(next);
    if (!next.length) setContentMode("choose"); // Sin elementos → vuelve a la elección inicial
  };
  // [deleteEntry · 2026-11-13]: elemento ya guardado → baja definitiva en NestJS (solo ADMIN) antes de quitarlo del formulario
  const [deleting, setDeleting] = useState<string | null>(null);
  const deleteEntry = async (entry: { uid: string; itemId?: string }) => {
    if (!entry.itemId) return removeEntry(entry.uid);
    if (!window.confirm("¿Eliminar este elemento del tema? No se puede deshacer.")) return;
    setDeleting(entry.uid);
    const r = await deleteResourceAction(entry.itemId);
    setDeleting(null);
    if (r.ok) removeEntry(entry.uid);
    else setErrors([r.message]);
  };

  // ───── Guardar ─────
  const missing = [
    ...(!language ? ["Idioma"] : []),
    ...(!level ? ["Nivel"] : []),
    ...(!skill ? ["Qué practica"] : []),
    ...(topicName.trim().length < 2 ? ["Tema"] : []),
    ...(contentMode === "choose" || !entries.length
      ? ["Contenido (genera con IA o escríbelo a mano)"]
      : entries.flatMap((e, i) => missingFields(kind, e.content, language).map((f) => (entries.length > 1 ? `Elemento ${i + 1}: ${f}` : f)))), // `flatMap` (ES2019)
    ...(!usesOwnSource && !source ? ["Fuente externa"] : []),
  ];

  // [payload]: cuerpo común de alta/edición por elemento | [Principio]: DRY
  const payloadFor = (entry: Entry, i: number) => ({
    key: entryKey(entry, i),
    kind,
    language,
    level,
    skill,
    topic: topicName.trim(),
    ...(catalogTopic && !isGroup && entries.length === 1 ? { topicId: catalogTopic.id } : {}), // Con topicId el backend deriva la clave del tema → solo para un elemento
    content: (compactContent(entry.content) as Record<string, unknown> | undefined) ?? {},
    provenance,
    ...(source?.id ? { sourceId: source.id } : {}),
    // [Trazabilidad IA]: se enlaza la generación solo si el contenido sigue marcado como generado
    ...(entry.generationId && provenance === "generated" ? { generationId: entry.generationId } : {}),
    ...(entry.itemId ? { expectedVersion: entry.version } : {}), // Concurrencia optimista por elemento
  });

  // [send]: una petición al BFF → id creado o mensaje de error | `async` (ES2017)
  // [2026-10-23]: 429 (ThrottlerException) → espera y reintenta (hasta RETRIES veces) en lugar de fallar los últimos elementos de un lote grande | [Patrón]: Retry with Backoff
  const send = async (entry: Entry, i: number, attempt = 0): Promise<{ id?: string; version?: number; error?: string }> => {
    try {
      // [Strategy]: elemento existente → PATCH (nueva versión) · nuevo → POST
      const res = await fetch(entry.itemId ? `/api/curriculum/${entry.itemId}` : "/api/curriculum", {
        method: entry.itemId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadFor(entry, i)),
      });
      if (res.status === 429 && attempt < RETRIES) {
        setProgress(`Límite de envíos alcanzado: esperando ${RETRY_WAIT_S} s para continuar (elemento ${i + 1} de ${entries.length})…`);
        await new Promise((r) => setTimeout(r, RETRY_WAIT_S * 1000)); // `setTimeout` en Promise: pausa sin bloquear la UI
        setProgress(null);
        return send(entry, i, attempt + 1); // Recursión acotada por RETRIES
      }
      // [2026-10-27]: `.catch` → una respuesta sin JSON (proxy caído) no se convierte en «No se pudo conectar» · `message` puede ser lista (class-validator/Zod)
      const body = (await res.json().catch(() => ({}))) as { message?: string | string[]; id?: string; version?: number };
      if (res.ok) return { id: body.id ?? entry.itemId, version: body.version };
      const message = Array.isArray(body.message) ? body.message.join("; ") : body.message;
      // [Mensaje real]: el backend ya traduce los errores conocidos (BD, tamaño, validación); el 500 genérico se explica en vez de mostrar «Internal server error»
      return { error: !message || message === "Internal server error" ? `Error interno del servidor (HTTP ${res.status}). Revisa el registro del backend.` : message };
    } catch {
      return { error: "No se pudo conectar con el servidor." };
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTriedSubmit(true);
    if (missing.length || keyConflict || submitting) return;
    setSubmitting(true);
    setErrors([]);
    // [Envío por elemento]: un recurso por elemento → el backend valida cada uno (esquema, idioma, clave única)
    // [2026-10-27 · Rendimiento]: antes `for…of` + `await` (uno tras otro) → ahora SAVE_PARALLEL a la vez con mapLimit; los resultados se procesan en el orden del formulario
    const created: string[] = [];
    const saved = new Map<string, { id: string; version?: number; key: string }>(); // uid → resultado (modo tema)
    let updated = 0;
    const failed: Array<{ uid: string; message: string }> = [];
    // [Sin cambios]: no se envía (ahorra peticiones y versiones) → `null` = omitido
    const results = await mapLimit(entries, SAVE_PARALLEL, (entry, i) => (entry.itemId && !entry.dirty ? Promise.resolve(null) : send(entry, i)));
    for (const [i, entry] of entries.entries()) {
      const r = results[i];
      if (!r) continue;
      if (r.id) {
        if (entry.itemId) updated += 1;
        else created.push(r.id);
        saved.set(entry.uid, { id: r.id, version: r.version, key: entryKey(entry, i) });
      } else failed.push({ uid: entry.uid, message: entries.length > 1 ? `Elemento ${i + 1}: ${r.error}` : (r.error ?? "") });
    }
    setSubmitting(false);
    const groupHref = `/admin/curriculum/tema?${groupQuery({ topic: topicName.trim(), language, level, kind })}`;

    if (!failed.length) {
      // [Éxito]: modal; al cerrarlo → tema (modo tema o varios), detalle (uno) o listado
      setDoneHref(isGroup || created.length > 1 ? groupHref : created.length === 1 ? `/admin/curriculum/${created[0]}` : isEdit ? `/admin/curriculum/${initial!.id}` : "/admin/curriculum");
      setResult({
        ok: true,
        message: isGroup ? fmt(rt.resourceGroupSaved, { topic: topicName.trim(), created: created.length, updated }) : isEdit ? rt.resourceUpdated : fmt(plural(locale, created.length, rt.resourceCreated), { n: created.length }),
      });
      return;
    }
    // [Error / parcial]: lo guardado pasa a "existente sin cambios" (reintentar no duplica ni choca de versión); quedan editables los fallidos
    setEntries((prev) =>
      isGroup
        ? prev.map((x) => (saved.has(x.uid) ? { ...x, itemId: saved.get(x.uid)!.id, version: saved.get(x.uid)!.version ?? x.version, key: saved.get(x.uid)!.key, dirty: false } : x))
        : prev.filter((x) => failed.some((f) => f.uid === x.uid)),
    );
    setErrors(failed.map((f) => f.message));
    const reason = failed.map((f) => f.message).join(" · ");
    setResult({
      ok: false,
      message: created.length ? fmt(rt.resourcePartial, { ok: created.length, total: entries.length, failed: reason }) : fmt(rt.resourceError, { reason }),
    });
  };

  const onCloseResult = () => {
    const ok = result?.ok;
    setResult(null);
    if (ok && doneHref) {
      router.push(doneHref);
      router.refresh();
    }
  };

  const shownErrors = errors.length ? errors : triedSubmit ? missing : [];
  const topicReady = comboReady && topicName.trim().length >= 2;
  const canGenerate = topicReady && aiBusy === null && !aiProgress;
  // [Texto de progreso]: "Generando 11–20 de 25…" en lotes; un solo lote → aviso de duración
  const generatingLabel = aiProgress && aiProgress.total > 1 ? `Generando ${aiProgress.done + 1}–${Math.min(aiProgress.done + batchFor(kind), aiProgress.total)} de ${aiProgress.total}…` : "Generando… (1-2 min)";

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate data-tried={triedSubmit || undefined}>
      <ResultDialog result={result} onClose={onCloseResult} />

      {shownErrors.length > 0 && (
        <div role="alert" className="rounded-lg border border-tone-danger-line bg-tone-danger-soft px-4 py-3 text-sm text-tone-danger">
          <p className="font-semibold">{errors.length ? "El servidor no aceptó el recurso:" : "Falta completar:"}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {shownErrors.map((m, i) => (
              <li key={`${i}-${m}`}>{m}</li> // [2026-10-27]: mensajes repetidos (mismo texto en dos ejemplos) → clave posición + texto
            ))}
          </ul>
        </div>
      )}

      {/* ── Paso 1: tipo ── */}
      <Step n={1} title="¿Qué vas a crear?" hint={isEdit ? "El tipo de un recurso existente no se puede cambiar." : undefined}>
        <div role="radiogroup" aria-labelledby="step-1" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {/* [2026-10-23 · 4.º pase]: sin «Traducción» (ahora es el Traductor del menú) salvo al editar un recurso que ya es de ese tipo */}
          {KINDS.filter((k) => RESOURCE_KINDS.includes(k) || k === kind).map((k) => {
            const m = KIND_META[k];
            const active = k === kind;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={locked && !active}
                onClick={() => onKindChange(k)}
                className={cn(
                  "flex gap-3 rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
                  active ? "border-primary bg-tone-brand-soft shadow-sm" : "border-border bg-card hover:border-primary/60",
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-tone-brand-soft text-tone-brand">
                  <KindIcon kind={k} className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm font-bold", active && "text-tone-brand")}>{m.label}</span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">{m.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Step>

      {/* ── Paso 2: idioma y nivel (condicionan todo lo demás) ── */}
      <Step n={2} title="¿Para qué idioma y nivel?" hint={isGroup ? "Idioma y nivel del tema (fijos al editar un tema)." : "El contenido se escribirá en este idioma."} disabled={isGroup}>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField<Language> id="language" label="Idioma" value={language} onChange={onLanguageChange} placeholder="Elige idioma…" options={LANGUAGES.map((l) => ({ value: l.value, label: l.label }))} invalid={triedSubmit && !language} />
          <SelectField<CefrLevel> id="level" label="Nivel del estudiante" value={level} onChange={setLevel} placeholder="Elige nivel…" options={LEVELS} invalid={triedSubmit && !level} disabled={levelLocked} hint={levelLocked ? "Se asigna solo al elegir el tema (paso 3). Podrás cambiarlo al editar." : undefined} />
        </div>
      </Step>

      {/* ── Paso 3: tema (lista) ── */}
      <Step
        n={3}
        title="¿Sobre qué tema?"
        // [Rúbrica · 2026-10-23]: se explica para qué sirve → el tema es la TAREA que se corrige y sus criterios van en español porque los lee el docente
        hint={comboReady && kind === "rubric" ? `Una rúbrica es la plantilla para CORREGIR una tarea abierta (redacción u oral) de ${languageLabel} ${level}. El tema es la tarea que se evalúa (p. ej. «Correo informal»); los criterios y descriptores van en español porque los usa el docente al calificar.` : comboReady ? `Temas de «${meta.label}» para ${languageLabel} ${level}. ¿No está el que buscas? Pide más a la IA (se añaden a la lista) o elige «Otro tema» al final.` : language ? "Elige el tema: el nivel se asigna según el tema (puedes cambiarlo)." : "Primero elige el idioma: la lista de temas depende de él y del tipo de recurso."}
        disabled={isGroup}
      >
        <div className={cn("grid gap-3", !skillFixed && "sm:grid-cols-[1fr_16rem]")}>
          <div className="space-y-2">
            {/* [Select de temas · 2026-10-27]: componente compartido (TopicSelect) — <optgroup> separa el temario de las sugerencias de la IA */}
            <TopicSelect id="topic" value={topicName} custom={customTopic} onChange={onTopicSelect} groups={groups} ready={Boolean(language)} language={language} invalid={triedSubmit && topicName.trim().length < 2} showTitle={false} level={level} onLevelChange={setLevel} />
            {/* [2026-10-19]: el tema en el idioma elegido, con IPA, audio y traducción (se ve antes de guardar) */}
            {/* [Pronunciación · 2026-10-23 · 4.º pase]: el tema es un fonema IPA → se muestra CUÁNDO se aplica (grafías + regla) en lugar de traducir el tema */}
            {kind === "pronunciation" && phoneme ? (
              <div role="note" className="space-y-1 rounded-lg border border-tone-brand-line bg-tone-brand-soft p-3 text-xs">
                <p className="font-bold text-tone-brand">
                  <span lang={`${language}-fonipa`} className="font-mono text-sm">/{phoneme.symbol}/</span> · {phoneme.example} <span lang={`${language}-fonipa`} className="font-mono font-normal text-muted-foreground">[{phoneme.exampleIpa}]</span>
                </p>
                <p><b>Se escribe:</b> {phoneme.spellings}</p>
                <p><b>Cuándo se aplica:</b> {phoneme.ruleEs}</p>
              </div>
            ) : (
              // [2026-11-13]: también los temas propios / generados con IA → título en el idioma estudiado + traducción (con espera al teclear)
              language && titleTopic.trim().length >= 2 && <TopicTitle topic={titleTopic} language={language} />
            )}
          </div>
          {!skillFixed && (
            <SelectField<CurriculumSkill>
              id="skill"
              label="¿Qué practica?"
              value={skill}
              onChange={setSkill}
              placeholder="Elige…"
              options={SKILLS.map((s) => ({ value: s, label: SKILL_LABEL[s] }))}
              hint={meta.skill ? `Sugerida para «${meta.label}».` : "Leer, escuchar, hablar, escribir…"}
              invalid={triedSubmit && !skill}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-outline" disabled={!comboReady || aiBusy !== null} aria-busy={aiBusy === "topics"} onClick={() => void suggestTopics()}>
            {aiBusy === "topics" ? "Pensando temas…" : <><Sparkles aria-hidden className="inline size-4 align-[-0.125em]" /> Sugerir más temas con IA</>}
          </button>
          {aiTopicsFresh.length > 0 && (
            <span role="status" className="text-[11px] text-muted-foreground">
              {aiTopicsFresh.length} tema{aiTopicsFresh.length === 1 ? "" : "s"} de la IA en la lista (grupo «<Sparkles aria-hidden className="inline size-4 align-[-0.125em]" /> Sugeridos por la IA»).
            </span>
          )}
        </div>
        {keyConflict && (
          <p role="alert" className="type-meta text-tone-danger">
            {keyConflict}
          </p>
        )}
        {isEdit && (
          // [Identificador]: solo en edición y plegado (en alta se genera solo)
          <details className="text-xs">
            <summary className="cursor-pointer font-semibold text-muted-foreground">Identificador técnico: {key || "—"}</summary>
            <input aria-label="Identificador técnico" value={manualKey ?? key} onChange={(e) => setManualKey(e.target.value)} className="control mt-2 w-full font-mono" />
          </details>
        )}
      </Step>

      {/* ── Paso 4: contenido — uno o varios elementos, con IA o a mano ── */}
      <Step
        n={4}
        invalid={triedSubmit && (contentMode === "choose" || !entries.length)}
        title={`Contenido · ${meta.label}${entries.length > 1 ? ` (${entries.length} elementos)` : ""}`}
        hint={contentMode === "fields" ? "Revisa los campos de cada elemento. Los que tienen * son obligatorios; el resto está en «Más detalles»." : `Crea uno o varios elementos de «${meta.label}» sobre el tema elegido; cada uno se guarda como un recurso.`}
      >
        {contentMode === "choose" ? (
          // [Elección inicial · 2026-10-23 · 4.º pase]: primero CUÁNTOS, luego tres tarjetas iguales en rejilla (IA · a mano · importar)
          // — antes botones, enlace, plantilla y avisos iban mezclados en una sola fila que se partía sin orden
          <div className="space-y-4">
            <CountInput id="count-choose" value={count} onChange={setCount} />
            <div className="grid gap-3 md:grid-cols-3">
              <ChoiceCard icon={<Sparkles className="size-4" />} title="Generar con IA" hint={canGenerate || aiBusy ? `Crea ${count === 1 ? "el elemento" : `${count} elementos distintos`} en ${languageLabel}; luego los revisas antes de guardar.` : "Para generar con IA, primero completa idioma, nivel y tema."}>
                <button type="button" className="btn btn-primary h-10 w-full" disabled={!canGenerate} aria-busy={aiBusy === "content"} onClick={() => void generateContent()}>
                  {/* [2026-11-16]: texto corto «Generar» (el número ya está en «¿Cuántos?») */}
                  {aiBusy === "content" || aiProgress ? generatingLabel : "Generar"}
                </button>
              </ChoiceCard>
              <ChoiceCard icon={<PenLine className="size-4" />} title="Escribir a mano" hint="Llenas tú los campos de cada elemento, con vista previa al lado.">
                <button type="button" className="btn btn-outline h-10 w-full" onClick={() => addManual(count)}>
                  Escribir
                </button>
              </ChoiceCard>
              <ChoiceCard icon={<FileUp className="size-4" />} title="Importar" hint={!language ? "Primero elige el idioma (se usa para leer imágenes y la IPA)." : kind === "exercise" ? "Word, PDF, imagen (OCR), Excel o el enlace de una página: se leen las preguntas, opciones y respuestas para revisarlas." : "Excel, CSV, Word, PDF, texto, imagen o el enlace de una página web: una fila por elemento."}>
                {/* [Importar]: requiere el idioma (OCR y variante IPA) */}
                <ImportPanel kind={kind} language={language} topic={topicName} disabled={!language} onImport={addImported} />
              </ChoiceCard>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry, i) => (
              // [Tarjeta por elemento]: editor + vista previa | `key` = uid estable (no el índice) → React conserva el foco al quitar elementos
              <article key={entry.uid} aria-label={`Elemento ${i + 1}`} className="space-y-3 surface-item">
                {(entries.length > 1 || !isEdit) && (
                  <header className="flex items-center justify-between gap-2">
                    <h3 className="title-card">
                      Elemento {i + 1}
                      {headline(entry.content) && <span className="font-normal text-muted-foreground"> · {headline(entry.content).slice(0, 60)}</span>}
                    </h3>
                    {isGroup && !entry.itemId && <span className="badge bg-tone-brand-soft text-tone-brand">Nuevo</span>}
                    {/* [2026-11-13]: nuevos → se quitan del formulario; existentes (modo tema, ADMIN) → DELETE /curriculum/:id tras confirmar | icono sin texto (mismo botón que Actividades) */}
                    {!isEdit && (!entry.itemId || (canAdmin && entries.length > 1)) && (
                      <button type="button" onClick={() => void deleteEntry(entry)} disabled={deleting === entry.uid} aria-busy={deleting === entry.uid} aria-label={`${entry.itemId ? "Eliminar" : "Quitar"} elemento ${i + 1}`} title={entry.itemId ? "Eliminar" : "Quitar"} className="btn btn-ghost btn-sm size-8 shrink-0 px-0! text-tone-danger">
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    )}
                  </header>
                )}
                <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
                  <ContentEditor kind={kind} language={language} value={entry.content as unknown as ContentByKind[typeof kind]} onChange={(v) => updateEntry(entry.uid, v as unknown as Record<string, unknown>)} />
                  <aside aria-label={`Vista previa del elemento ${i + 1}`} className="h-fit rounded-xl border border-dashed border-tone-brand-line bg-muted p-4">
                    <p className="mb-2 type-meta font-bold uppercase tracking-wider text-muted-foreground">Así lo verá el estudiante</p>
                    <ResourcePreview kind={kind} content={entry.content} language={language || undefined} />
                  </aside>
                </div>
              </article>
            ))}

            {/* [Más elementos]: añadir a mano o generar más con IA (alta) · volver a generar (edición) */}
            {isEdit ? (
              canGenerate && (
                <button type="button" className="btn btn-ghost" aria-busy={aiBusy === "content"} disabled={aiBusy !== null} onClick={() => void generateContent({ force: true })}>
                  {aiBusy === "content" ? "Generando…" : <><Sparkles aria-hidden className="inline size-4 align-[-0.125em]" /> Volver a generar con IA</>}
                </button>
              )
            ) : (
              // [Más elementos · 2026-10-23 · 4.º pase]: cantidad arriba; acciones en una fila; importar (archivo, enlace, plantilla) en su propia fila
              <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
                <CountInput id="count-more" value={count} onChange={setCount} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-outline" disabled={!canGenerate} aria-busy={aiBusy === "content"} onClick={() => void generateContent({ force: true, append: true })}>
                    {aiBusy === "content" || aiProgress ? generatingLabel : <><Sparkles aria-hidden className="inline size-4 align-[-0.125em]" /> {`Generar ${count} más con IA`}</>}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => addManual(count)}>
                    <PenLine aria-hidden className="inline size-4 align-[-0.125em]" /> Añadir {count} a mano
                  </button>
                </div>
                <ImportPanel kind={kind} language={language} topic={topicName} disabled={!language} onImport={addImported} />
              </div>
            )}
          </div>
        )}
        {aiError && (
          <p role="alert" className="rounded-lg border border-tone-danger-line bg-tone-danger-soft px-3 py-2 type-meta text-tone-danger">
            {aiError}
          </p>
        )}

        {/* [Resultado de la IA]: qué se hizo — el LLM solo se usa si no había nada reutilizable */}
        {draft?.strategy === "existing" && (
          <div role="status" className="space-y-2 rounded-lg border border-tone-info-line bg-tone-info-soft p-3 text-xs text-tone-info">
            <p>
              <Recycle aria-hidden className="inline size-4 align-[-0.125em]" /> <b>Ya existe un recurso de este tipo para «{topicName}»</b>. Para no duplicar contenido no se usó la IA.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/curriculum/${draft.existingItemId}`} className="btn btn-primary">
                Abrir el existente
              </Link>
              <button type="button" className="btn btn-outline" disabled={aiBusy !== null} onClick={() => void generateContent({ force: true })}>
                Generar uno nuevo igualmente
              </button>
            </div>
          </div>
        )}
        {draft?.strategy === "cache" && (
          <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-tone-info-line bg-tone-info-soft p-3 text-xs text-tone-info">
            <span className="flex-1"><Recycle aria-hidden className="inline size-4 align-[-0.125em]" /> Reutilizado de una generación anterior idéntica — <b>no se usó la IA</b> (LLM_REQUIRED = false).</span>
            <button type="button" className="btn btn-outline" disabled={aiBusy !== null} onClick={() => void generateContent({ force: true })}>
              Generar otra versión
            </button>
          </div>
        )}
        {draft?.trace && draft.strategy !== "existing" && (
          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground"><Search aria-hidden className="inline size-4 align-[-0.125em]" /> Trazabilidad de la generación</summary>
            <div className="mt-3">
              <GenerationTrace trace={draft.trace} />
            </div>
          </details>
        )}
      </Step>

      {/* ── Origen (plegado: casi siempre es contenido propio) ── */}
      <details className="surface p-5" open={provenance === "imported"}>
        <summary className="cursor-pointer text-sm font-bold">
          Origen del contenido <span className="font-normal text-muted-foreground">· {PROVENANCE_LABEL[provenance]} — ábrelo solo si lo tomaste de un libro o una web</span>
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="provenance" className="mb-1 block text-xs font-semibold text-muted-foreground">
              ¿De dónde sale?
            </label>
            <select id="provenance" className="control w-full" value={provenance} onChange={(e) => onProvenanceChange(e.target.value as Provenance)}>
              {PROVENANCES.map((p) => (
                <option key={p} value={p}>
                  {PROVENANCE_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
          {!usesOwnSource && (
            <div className="space-y-2">
              <SearchSelect<SourceOption> id="source" label="Libro, web o diccionario *" placeholder="Buscar fuente…" value={source} onSelect={setSource} fetchOptions={fetchSources} contextKey="sources" />
              {canAdmin && !showSourcePanel && (
                <button type="button" className="btn btn-outline" onClick={() => setShowSourcePanel(true)}>
                  + Registrar fuente nueva
                </button>
              )}
            </div>
          )}
          {showSourcePanel && !usesOwnSource && (
            <div className="sm:col-span-2">
              <SourceCreatePanel
                onCancel={() => setShowSourcePanel(false)}
                onCreated={(s) => {
                  setSource(toSourceOption(s));
                  setShowSourcePanel(false);
                }}
              />
            </div>
          )}
        </div>
      </details>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <p className="mr-auto type-meta text-muted-foreground">
          {isGroup
            ? "Solo se guardan los elementos nuevos y los que modificaste (cada cambio crea una versión)."
            : isEdit
              ? "Guardar crea una nueva versión (queda en el historial)."
              : "Se guarda como borrador: los estudiantes lo verán cuando se publique."}
        </p>
        {progress && (
          <p role="status" aria-live="polite" className="w-full type-meta font-semibold text-tone-brand">
            {progress}
          </p>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting} aria-busy={submitting}>
          {submitting
            ? "Guardando…"
            : isGroup || isEdit
              ? "Guardar" // [2026-11-13]: edición = «Cancelar» + «Guardar» (mismo par que Actividades)
              : entries.length > 1
                  ? `Crear ${entries.length} recursos`
                  : "Crear recurso"}
        </button>
      </div>
    </form>
  );
}
