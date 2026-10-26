"use client"; // [Next.js]: Client Component → borrador en memoria, importación en el navegador y Server Actions
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileUp, PenLine, Plus, Sparkles } from "lucide-react";
import { ChoiceCard, CountInput, Step } from "@/components/curriculum/CurriculumItemForm"; // [DRY]: MISMOS bloques que «Crear recurso»
import { ACTIVITY_KINDS, emptyDraft, mergeDraft, validateDraft, wordCount, type ActivityDraft, type CreatableKind, type Entry, type ImportSource } from "@/lib/activity-kinds";
import type { Extracted } from "@/lib/resource-import";
import { createActivityAction, draftActivityAction } from "@/app/(portal)/admin/activities/actions";
import { FieldInput } from "./FieldInput";
import { DraftEditor, UID } from "./DraftEditor";
import { SourceImport } from "./SourceImport";
import { ActivityCreated } from "./ActivityCreated";
import { ResultDialog, type SaveResult } from "@/components/shared/ResultDialog"; // [2026-10-25]: mismo aviso que Recursos
// [ActivityCreateForm · 2026-10-24]: pasos «Datos» y «Contenido» de Gestión → Crear actividad — TODO en la página (sin ventanas modales), igual que «Crear recurso»
// Contenido con tres caminos en tarjetas iguales: IA (borrador de NestJS/Ollama), a mano (filas vacías) e importar (archivo, enlace, OCR, audio/video)
// El formulario es GENÉRICO: los campos, el mapeo de lo importado, la IA y el guardado salen de la estrategia del tipo (lib/activity-kinds)
// [Patrón]: Container (estado) + Strategy (ACTIVITY_KINDS[kind]) + Command (Server Actions) | [Principio]: OCP + DRY + SRP | [Paradigma]: Reactivo (estado → vista)

interface ActivityCreateFormProps {
  kind: CreatableKind;
  language: string; // Del paso 1 (URL) → el servidor ya lo validó
  level: string;
  listHref: string;
  firstStep: number; // Número del primer paso de este formulario (la página pinta los anteriores)
}

let seq = 0; // Contador del módulo → `_uid` único por fila sin depender de Date/random (SSR-safe: solo se usa en eventos)
const withUid = (e: Entry): Entry => ({ ...e, [UID]: e[UID] ?? `r${++seq}` });

export function ActivityCreateForm({ kind, language, level, listHref, firstStep }: ActivityCreateFormProps) {
  const s = ACTIVITY_KINDS[kind];
  const ctx = { language, level };
  const [draft, setDraft] = useState<ActivityDraft>(() => emptyDraft(kind)); // `useState(() => …)`: inicialización perezosa
  const [mode, setMode] = useState<"choose" | "edit">("choose");
  const [count, setCount] = useState(s.ai.defaultCount);
  const [source, setSource] = useState<{ text: string; label: string } | null>(null); // Último material importado (lo puede usar la IA)
  const [useSource, setUseSource] = useState(true);
  const [busy, setBusy] = useState<"ai" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [created, setCreated] = useState<{ id: string; warnings: string[] } | null>(null);
  const [origin, setOrigin] = useState<"ai" | "manual" | null>(null); // [2026-10-25]: campos «solo a mano» (resumen, autor…) aparecen al escribir o importar
  const router = useRouter();
  // [done · 2026-10-25]: como «Crear recurso» → aviso de éxito y, al cerrarlo, la página de REVISIÓN (vista previa + Publicar) · el panel solo si hay avisos o audio por subir
  const [result, setResult] = useState<SaveResult | null>(null);
  const [reviewHref, setReviewHref] = useState<string | null>(null);
  const done = (id: string, warnings: string[]) => {
    if (warnings.length || s.mediaUpload) return setCreated({ id, warnings });
    setReviewHref(`/admin/activities/ver/${kind}/${encodeURIComponent(id)}`);
    setResult({ ok: true, message: `${s.label} guardada como borrador. Revísala y publícala cuando esté lista.` });
  };
  const onCloseResult = () => {
    setResult(null);
    if (reviewHref) router.push(reviewHref);
  };

  const ready = kind === "polyglot" || Boolean(language && level); // Poliglota muestra el tema en los siete idiomas
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
    if (!res.ok) return setError(res.message);
    if (res.result.kind === "created") return done(res.result.id, []);
    setOrigin((o) => o ?? "ai");
    if (!res.result.draft.entries?.length) return setError("La IA no devolvió contenido utilizable. Intenta de nuevo o cambia el tema.");
    add(res.result.draft);
    setNotice(`La IA añadió ${res.result.draft.entries.length} ${s.entryLabel.toLowerCase()}(s). Revísalos antes de guardar.${res.result.note ? ` ${res.result.note}` : ""}`);
  };

  // [onExtracted]: Extracted → mapeo del tipo (determinístico) · el texto queda disponible para la IA si no se reconocen filas
  const onExtracted = (ex: Extracted, src: ImportSource) => {
    setError(null);
    const text = ex.text || ex.rows.map((r) => r.join(" | ")).join("\n");
    setSource({ text, label: src.title || src.label });
    setOrigin("manual");
    const part = s.fromExtracted(ex, ctx, src);
    if (part.entries?.length || part.meta) add(part);
    setNotice(
      part.entries?.length
        ? `Se importaron ${part.entries.length} ${s.entryLabel.toLowerCase()}(s). Revísalos abajo.`
        : s.ai.usesSource
          ? "No se reconocieron filas con el formato esperado. Usa «Generar con IA»: se basará en el material importado."
          : "No se reconoció contenido con el formato esperado; complétalo a mano.",
    );
  };

  const addManual = (n: number) => {
    setOrigin("manual");
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
    if (!res.ok) return setError(res.message);
    done(res.id, res.warnings);
  };

  // [reset]: «Crear otra» → borrador limpio del mismo tipo (idioma y nivel se conservan en la URL)
  const reset = () => {
    setDraft(emptyDraft(kind));
    setMode("choose");
    setSource(null);
    setProblems([]);
    setNotice(null);
    setCreated(null);
    setOrigin(null);
  };

  if (created) return <ActivityCreated kind={kind} id={created.id} warnings={created.warnings} listHref={listHref} onAnother={reset} />;

  const aiDisabled = !ready || !titleOk || busy !== null;
  const aiButton = (label: string) => (
    <button type="button" className="btn btn-primary w-full sm:w-auto" disabled={aiDisabled} aria-busy={busy === "ai"} onClick={() => void generate()}>
      <Sparkles aria-hidden className="size-4" /> {busy === "ai" ? "Generando… (la IA local puede tardar)" : label}
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
      <ResultDialog result={result} onClose={onCloseResult} />
      {/* ── Datos de la actividad ── */}
      <Step n={firstStep} title={`Datos · ${s.label}`} hint={ready ? "El título también es el tema que usa la IA." : "Primero elige idioma y nivel en el paso 1."} invalid={problems.length > 0 && !titleOk}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="act-title" className="mb-1 block text-xs font-semibold text-muted-foreground">
              Título o tema <span className="req" aria-hidden>*</span>
            </label>
            <input id="act-title" required maxLength={160} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Ej.: En el restaurante" aria-invalid={(problems.length > 0 && !titleOk) || undefined} className="control w-full" autoComplete="off" />
          </div>
          {s.meta.filter((f) => !f.manualOnly || origin === "manual").map((f) => (
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
              {aiButton("Generar con IA")}
            </ChoiceCard>
            <ChoiceCard icon={<PenLine className="size-4" />} title="Escribir a mano" hint={`Llenas tú cada ${s.entryLabel.toLowerCase()} en la página.`}>
              <button type="button" className="btn btn-outline w-full" onClick={() => addManual(Math.max(1, s.minEntries))}>
                <PenLine aria-hidden className="size-4" /> Empezar a mano
              </button>
            </ChoiceCard>
            <ChoiceCard icon={<FileUp className="size-4" />} title="Importar" hint="Archivo, enlace, imagen o audio/video.">
              <SourceImport language={language} disabled={!ready} hint={s.importHint} onExtracted={onExtracted} />
            </ChoiceCard>
          </div>
        ) : (
          <div className="space-y-4">
            <DraftEditor strategy={s} entries={draft.entries} onChange={(entries) => setDraft((d) => ({ ...d, entries }))} />
            {kind === "reading" && <p className="text-xs text-muted-foreground">Longitud: <b>{wordCount(draft.entries)}</b> palabras (se calcula sola con el texto).</p>}
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
          <p role="status" className="rounded-lg border border-tone-info-line bg-tone-info-soft px-3 py-2 text-xs text-tone-info">
            {notice}
          </p>
        )}
      </Step>

      {/* ── Guardar ── */}
      {(error || problems.length > 0) && (
        <div role="alert" className="rounded-lg border border-tone-danger-line bg-tone-danger-soft p-3 text-sm text-tone-danger">
          {error && <p>{error}</p>}
          {problems.length > 0 && (
            <ul className="list-inside list-disc text-xs">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Link href={listHref} className="btn btn-ghost">
          Cancelar
        </Link>
        <button type="button" className="btn btn-primary" disabled={busy !== null || !ready} aria-busy={busy === "save"} onClick={() => void save()}>
          {busy === "save" ? "Guardando…" : "Guardar actividad"}
        </button>
      </div>
    </div>
  );
}
