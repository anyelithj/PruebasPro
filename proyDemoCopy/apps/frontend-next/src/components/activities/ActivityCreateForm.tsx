"use client"; // [Next.js]: Client Component → borrador en memoria, importación en el navegador y Server Actions
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileUp, PenLine, Plus, Sparkles } from "lucide-react";
import { ChoiceCard, CountInput, Step } from "@/components/curriculum/CurriculumItemForm"; // [DRY]: MISMOS bloques que «Crear recurso»
import { ACTIVITY_KINDS, LEVEL_FROM_TEXT, draftOrigin, emptyDraft, fieldApplies, mergeDraft, ORIGIN_KEY, validateDraft, wordCount, type ActivityDraft, type CreatableKind, type DraftOrigin, type Entry, type ImportSource } from "@/lib/activity-kinds";
import { onlyLanguage, type Extracted } from "@/lib/resource-import";
import { createActivityAction, draftActivityAction } from "@/app/(portal)/admin/activities/actions";
import { FieldInput } from "./FieldInput";
import { DraftEditor, UID } from "./DraftEditor";
import { SourceImport } from "./SourceImport";
import { ResultDialog, useResultDialog } from "@/components/shared/ResultDialog"; // [2026-10-28]: MISMO modal «se creó con éxito» → Continuar que «Crear recurso» y «Crear examen» (antes toast + redirección inmediata)
import { activityCurated, ACTIVITY_TOPIC_SOURCE, TopicSelect, topicGroups, useCatalogTopics } from "@/components/curriculum/TopicSelect"; // [2026-10-27 · DRY]: MISMO campo «Tema» que «Crear recurso»
import type { CefrLevel } from "@/types/courses";
import { textLevel, topicLevel } from "@/config/curriculum-topics"; // [2026-11-16]: ¿el tema libre trae nivel?
import type { Language } from "@/types/quiz";
// [ActivityCreateForm · 2026-10-24]: pasos «Datos» y «Contenido» de Gestión → Crear actividad — TODO en la página (sin ventanas modales), igual que «Crear recurso»
// Contenido con tres caminos en tarjetas iguales: IA (borrador de NestJS/Ollama), a mano (filas vacías) e importar (archivo, enlace, OCR, audio/video)
// El formulario es GENÉRICO: los campos, el mapeo de lo importado, la IA y el guardado salen de la estrategia del tipo (lib/activity-kinds)
// [Patrón]: Container (estado) + Strategy (ACTIVITY_KINDS[kind]) + Command (Server Actions) | [Principio]: OCP + DRY + SRP | [Paradigma]: Reactivo (estado → vista)

interface ActivityCreateFormProps {
  kind: CreatableKind;
  language: string; // Del paso 1 (URL) → el servidor ya lo validó
  level: string;
  languages?: string[]; // [2026-11-11]: Poliglota → idiomas elegidos en el paso 2 (multiselect)
  listHref: string;
  firstStep: number; // Número del primer paso de este formulario (la página pinta los anteriores)
}

let seq = 0; // Contador del módulo → `_uid` único por fila sin depender de Date/random (SSR-safe: solo se usa en eventos)
const withUid = (e: Entry): Entry => ({ ...e, [UID]: e[UID] ?? `r${++seq}` });

export function ActivityCreateForm({ kind, language, level, languages, listHref, firstStep }: ActivityCreateFormProps) {
  const s = ACTIVITY_KINDS[kind];
  const ctx = { language, level };
  const [rawDraft, setDraft] = useState<ActivityDraft>(() => emptyDraft(kind));
  // [2026-11-11]: los idiomas viven en la URL (paso 2) → se inyectan en `meta.languages` (columnas del editor, IA y guardado)
  const draft: ActivityDraft = languages ? { ...rawDraft, meta: { ...rawDraft.meta, languages: languages.join(",") } } : rawDraft; // `useState(() => …)`: inicialización perezosa
  const [mode, setMode] = useState<"choose" | "edit">("choose");
  const [count, setCount] = useState(s.ai.defaultCount);
  const [source, setSource] = useState<{ text: string; label: string } | null>(null); // Último material importado (lo puede usar la IA)
  const [useSource, setUseSource] = useState(true);
  const [busy, setBusy] = useState<"ai" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState(false); // [2026-10-27]: «Otro tema (escribirlo)…» del select de temas
  const { show, dialog } = useResultDialog(); // [Modal de resultado]: éxito → Continuar → revisión del borrador · error → se corrige aquí
  // [origin · 2026-10-27]: vive en `draft.meta.origin` (viaja a la Server Action) → decide si se piden los datos de derechos (solo texto importado)
  // «import» domina: si se importó material, aunque luego la IA se base en él, el texto es de terceros | [Patrón]: State (máquina mínima ai/own → import)
  const origin = draftOrigin(draft);
  const markOrigin = (next: DraftOrigin) => setDraft((d) => (draftOrigin(d) === "import" ? d : { ...d, meta: { ...d.meta, [ORIGIN_KEY]: next } }));
  // [Temas · 2026-10-27]: misma fuente que Recursos (catálogo curado + temario guardado) según la sección
  const topicSrc = ACTIVITY_TOPIC_SOURCE[kind];
  const catalog = useCatalogTopics({ language: language as Language | "", level: level as CefrLevel | "", skill: topicSrc?.skill ?? "", kind: topicSrc?.kind ?? "exercise" });
  const groups = topicGroups(activityCurated(kind, language as Language | "", level as CefrLevel | ""), catalog);
  // [done · 2026-10-28]: IGUAL que «Crear recurso» → modal «se creó con éxito» y, al pulsar Continuar, la página de DETALLE del registro (donde vive): en Borrador con Editar · Publicar · Eliminar
  // Los avisos de pasos secundarios (p. ej. vocabulario que no se pudo vincular) van en el mismo mensaje → el usuario los lee antes de continuar | `join(" ")` (ES5)
  const done = (id: string, warnings: string[], href?: string) =>
    show(
      { ok: true, message: [`«${draft.title.trim() || s.label}» (${s.label}) se creó con éxito y queda en borrador. Revísala y publícala cuando esté lista.`, ...warnings].join(" ") },
      href ?? `/admin/activities/ver/${kind}/${encodeURIComponent(id)}`, // `encodeURIComponent` (Web API): id seguro en la ruta · [2026-11-16]: `href` → otra pantalla (tema de conversación)
    );

  // [2026-11-16 · RF-148]: el nivel ya no se elige antes → basta el idioma; lo asigna el tema (o NestJS lo estima del texto en lectura/diálogo)
  const ready = kind === "polyglot" || Boolean(language); // Poliglota muestra el tema en los siete idiomas
  // [2026-11-09 · Nivel según el tema]: el nivel vive en la URL (?nivel=) → elegir un tema de otro nivel la actualiza sin perder el borrador
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const setParam = (key: "nivel" | "libre", v: string) => {
    const q = new URLSearchParams(params.toString());
    if (v) q.set(key, v);
    else q.delete(key);
    if (q.toString() !== params.toString()) router.replace(`${pathname}?${q}`, { scroll: false });
  };
  const setLevel = (l: CefrLevel) => setParam("nivel", l);
  // [?libre=1 · 2026-11-16]: tema libre sin nivel en el catálogo → se habilita el select de nivel del paso 2 (ActivityLangLevel)
  const freeTopic = customTopic && draft.title.trim().length >= 2 && !(topicLevel(draft.title, language as Language | "") ?? textLevel(draft.title, language as Language | ""));
  useEffect(() => setParam("libre", freeTopic ? "1" : ""), [freeTopic]); // eslint-disable-line react-hooks/exhaustive-deps -- solo al cambiar el resultado
  const titleOk = draft.title.trim().length >= 2;
  const setMeta = (key: string, v: string) => setDraft((d) => ({ ...d, meta: { ...d.meta, [key]: v } }));
  // [add]: une lo nuevo (IA, importado, a mano) al borrador y pasa al modo edición | `setState(fn)`: sin estado obsoleto
  const add = (part: Partial<ActivityDraft>) => {
    setDraft((d) => mergeDraft(d, { ...part, entries: (part.entries ?? []).map(withUid) }));
    setMode("edit");
  };

  // [generate]: Server Action → borrador para revisar o recurso ya creado (gramática/poliglota)
  const generate = async () => {
    setBusy("ai");
    setError(null);
    setNotice(null);
    const res = await draftActivityAction(kind, ctx, { topic: draft.title, count, sourceText: useSource && s.ai.usesSource ? source?.text : undefined, meta: draft.meta });
    setBusy(null);
    if (!res.ok) {
      show({ ok: false, message: `No se pudo crear la actividad: ${res.message}` }); // [2026-11-11]: misma alerta que «Crear actividad» (p. ej. «Ya existe un tema con ese nombre»)
      return setError(res.message);
    }
    if (res.result.kind === "created") return done(res.result.id, []);
    markOrigin("ai");
    if (!res.result.draft.entries?.length) return setError("La IA no devolvió contenido utilizable. Intenta de nuevo o cambia el tema.");
    add(res.result.draft);
    setNotice(`La IA añadió ${res.result.draft.entries.length} ${s.entryLabel.toLowerCase()}(s). Revísalos antes de guardar.${res.result.note ? ` ${res.result.note}` : ""}`);
  };

  // [onExtracted]: Extracted → mapeo del tipo (determinístico) · el texto queda disponible para la IA si no se reconocen filas
  const onExtracted = (raw: Extracted, src: ImportSource) => {
    setError(null);
    // [2026-11-03]: solo el contenido del idioma elegido en el paso 1 (Poliglota trae los siete → sin filtro)
    const { ex, dropped } = kind === "polyglot" ? { ex: raw, dropped: 0 } : onlyLanguage(raw, language);
    const text = ex.text || ex.rows.map((r) => r.join(" | ")).join("\n");
    setSource({ text, label: src.title || src.label });
    setDraft((d) => ({ ...d, meta: { ...d.meta, [ORIGIN_KEY]: "import" } })); // Texto de terceros → se piden los datos de derechos
    const part = s.fromExtracted(ex, ctx, src);
    // [Valores por defecto · 2026-11-03]: idioma y nivel ya vienen del paso 1 → se rellenan los selects obligatorios vacíos y la fuente con el enlace/archivo importado
    const defaults: Record<string, string> = { licenseSource: src.url ?? src.title ?? src.label };
    if (src.url) { try { defaults.licenseHolder = new URL(src.url).hostname.replace(/^www\./, ""); } catch { /* enlace sin URL válida */ } }
    for (const f of s.meta) if (f.type === "select" && f.required && f.options?.length) defaults[f.key] = f.options[0]!.value;
    setDraft((d) => mergeDraft(d, { meta: defaults })); // `mergeDraft`: solo rellena los campos vacíos (no pisa lo que el autor ya eligió)
    if (part.entries?.length || part.meta) add(part);
    const skippedNote = dropped ? ` Se descartaron ${dropped} líneas en otro idioma.` : "";
    setNotice(
      dropped && !ex.text.trim() && !ex.rows.length ? `Todo el material está en otro idioma: no hay contenido en el idioma elegido.` : (part.entries?.length
        ? `Se importaron ${part.entries.length} ${s.entryLabel.toLowerCase()}(s). Revísalos abajo.`
        : s.ai.usesSource
          ? "No se reconocieron filas con el formato esperado. Usa «Generar con IA»: se basará en el material importado."
          : "No se reconoció contenido con el formato esperado; complétalo a mano.") + skippedNote,
    );
  };

  const addManual = (n: number) => {
    if (!origin) markOrigin("own"); // Escribir a mano sobre un borrador de la IA no cambia su origen
    add({ entries: Array.from({ length: n }, s.emptyEntry) }); // `Array.from({ length })` (ES2015): n filas vacías
  };

  // [save]: mismas reglas en cliente (respuesta inmediata) y en la Server Action (seguridad)
  const save = async () => {
    const found = validateDraft(kind, draft, ctx);
    setProblems(found);
    if (found.length) return;
    setBusy("save");
    setError(null);
    const res = await createActivityAction(kind, ctx, draft);
    setBusy(null);
    if (!res.ok) {
      if (!level && LEVEL_FROM_TEXT.has(kind)) setParam("libre", "1"); // [RF-148]: la estimación del nivel falló → el docente lo elige
      show({ ok: false, message: `No se pudo crear la actividad: ${res.message}` }); // [Error]: modal (como Recursos) + aviso en línea; el borrador sigue en pantalla
      return setError(res.message);
    }
    done(res.id, res.warnings, res.href);
  };

  const aiDisabled = !ready || !titleOk || busy !== null || (kind !== "polyglot" && !level); // La IA escribe PARA un nivel → antes, tema del catálogo o nivel elegido
  // [2026-11-16]: `full` → mismo ancho y alto (h-10) que «Escribir» en las tarjetas de inicio
  const aiButton = (label: string, full = false) => (
    <button type="button" className={`btn btn-primary ${full ? "h-10 w-full" : "w-full sm:w-auto"}`} disabled={aiDisabled} aria-busy={busy === "ai"} onClick={() => void generate()}>
      {/* [2026-11-16]: botón sin icono (el icono ya está en la cabecera de la tarjeta) */}
      {busy === "ai" ? "Generando… (la IA puede tardar)" : label}
    </button>
  );
  const sourceToggle = source && s.ai.usesSource && (
    <label className="flex items-start gap-2 text-xs">
      <input type="checkbox" checked={useSource} onChange={(e) => setUseSource(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
      <span>Basarse en el material importado («{source.label}»)</span>
    </label>
  );
  const countInput = (id: string) => s.ai.countLabel && <CountInput id={id} label={s.ai.countLabel} value={count} max={s.ai.maxCount} onChange={setCount} />;

  return (
    <div className="space-y-5">
      <ResultDialog {...dialog} /> {/* [Modal de resultado]: controlado por useResultDialog (spread de props) */}
      {/* ── Datos de la actividad ── */}
      <Step n={firstStep} title={`Datos · ${s.label}`} hint={ready ? "Elige el tema de la lista (el mismo temario que Recursos) o escribe otro; también es el tema que usa la IA." : "Primero elige el idioma en el paso 2; el nivel se asigna al elegir el tema."} invalid={problems.length > 0 && !titleOk}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            {/* [Tema · 2026-10-27]: <select> con los temas, IGUAL que «Crear recurso» (antes un campo de texto libre) | el tema es el título de la actividad */}
            <TopicSelect id="act-title" value={draft.title} custom={customTopic} onChange={(topic, custom) => { setCustomTopic(custom); setDraft((d) => ({ ...d, title: topic })); }} groups={groups} ready={kind === "polyglot" || Boolean(language)} language={kind === "polyglot" ? "" : (language as Language | "")} invalid={problems.length > 0 && !titleOk} level={level as CefrLevel | ""} onLevelChange={setLevel} />
          </div>
          {/* [2026-10-27]: los datos de derechos (licencia, titular…) solo con texto importado · los de «solo a mano» al escribir o importar */}
          {s.meta.filter((f) => fieldApplies(f, origin, draft.meta)).map((f) => (
            <FieldInput key={f.key} id={`meta-${f.key}`} field={f} value={draft.meta[f.key] ?? ""} onChange={(v) => setMeta(f.key, v)} />
          ))}
        </div>
      </Step>

      {/* ── Contenido: IA · a mano · importar (tarjetas en línea, sin modales) ── */}
      <Step n={firstStep + 1} title={mode === "edit" ? `${s.entriesTitle} (${draft.entries.length})` : "Contenido"} hint={mode === "edit" ? "Revisa cada fila. Puedes seguir añadiendo con IA, a mano o importando." : "Elige cómo empezar; luego revisas todo antes de guardar."}>
        {mode === "choose" ? (
          <div className="grid gap-3 md:grid-cols-3">
            <ChoiceCard icon={<Sparkles className="size-4" />} title="Generar con IA" hint={titleOk ? s.ai.hint : "Escribe primero el título o tema (arriba)."}>
              {countInput("count-choose")}
              {aiButton("Generar", true)}
            </ChoiceCard>
            <ChoiceCard icon={<PenLine className="size-4" />} title="Escribir a mano" hint={`Llenas tú cada ${s.entryLabel.toLowerCase()} en la página.`}>
              {/* [2026-11-16]: «Escribir» sin icono, igual que «Generar» */}
              <button type="button" className="btn btn-outline h-10 w-full" onClick={() => addManual(Math.max(1, s.minEntries))}>
                Escribir
              </button>
            </ChoiceCard>
            <ChoiceCard icon={<FileUp className="size-4" />} title="Importar" hint="Archivo, enlace, imagen o audio/video.">
              <SourceImport language={language} disabled={!ready} hint={s.importHint} onExtracted={onExtracted} />
            </ChoiceCard>
          </div>
        ) : (
          <div className="space-y-4">
            <DraftEditor strategy={s} meta={draft.meta} entries={draft.entries} onChange={(entries) => setDraft((d) => ({ ...d, entries }))} />
            {kind === "reading" && <p className="type-meta text-muted-foreground">Longitud: <b>{wordCount(draft.entries)}</b> palabras (se calcula sola con el texto).</p>}
            {/* [Añadir más]: mismas tres vías, compactas, debajo de la lista */}
            <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
              <div className="flex flex-wrap items-end gap-3">
                {countInput("count-more")}
                {aiButton(s.ai.countLabel ? "Generar más con IA" : "Crear con IA")}
                <button type="button" className="btn btn-outline" onClick={() => addManual(1)}>
                  <Plus aria-hidden className="size-4" /> Añadir {s.entryLabel.toLowerCase()}
                </button>
              </div>
              {sourceToggle}
              <SourceImport language={language} disabled={!ready} hint={s.importHint} onExtracted={onExtracted} />
            </div>
          </div>
        )}
        {mode === "choose" && sourceToggle}
        {notice && (
          <p role="status" className="rounded-lg border border-tone-info-line bg-tone-info-soft px-3 py-2 type-meta text-tone-info">
            {notice}
          </p>
        )}
      </Step>

      {/* ── Guardar ── */}
      {(error || problems.length > 0) && (
        <div role="alert" className="rounded-lg border border-tone-danger-line bg-tone-danger-soft p-3 text-sm text-tone-danger">
          {error && <p>{error}</p>}
          {problems.length > 0 && (
            <ul className="list-inside list-disc type-meta">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {/* [Acciones · 2026-10-27]: «Cancelar» a la izquierda del principal (mismo orden en todas las secciones) | este formulario solo CREA (la edición vive en cada editor) → «Crear actividad», no «Guardar» */}
      <div className="flex flex-wrap justify-end gap-2">
        <Link href={listHref} className="btn btn-ghost">
          Cancelar
        </Link>
        <button type="button" className="btn btn-primary" disabled={busy !== null || !ready} aria-busy={busy === "save"} onClick={() => void save()}>
          {busy === "save" ? "Creando…" : "Crear actividad"}
        </button>
      </div>
    </div>
  );
}
