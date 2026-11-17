"use client"; // [Next.js]: Client Component → edición en línea del tema, los datos y las filas
import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { updateActivityAction } from "@/app/(portal)/admin/activities/actions";
import { ACTIVITY_KINDS, draftOrigin, fieldApplies, polyLangs, validateDraft, type ActivityDraft, type CreatableKind, type Entry, type KindContext } from "@/lib/activity-kinds";
import { LEVEL_OPTIONS } from "@/lib/languages";
import { ResultDialog, useResultDialog } from "@/components/shared/ResultDialog"; // [2026-10-28]: MISMO modal de resultado que «Editar recurso» (antes toast + redirección inmediata)
import { activityCurated, ACTIVITY_TOPIC_SOURCE, TopicSelect, topicGroups, useCatalogTopics } from "@/components/curriculum/TopicSelect";
import { Step } from "@/components/curriculum/CurriculumItemForm";
import type { CefrLevel } from "@/types/courses";
import type { Language } from "@/types/quiz";
import { DraftEditor, UID } from "./DraftEditor";
import { FieldInput } from "./FieldInput";
import { LanguageChecks } from "@/components/admin/ActivityLangLevel";
// [ActivityEditForm · 2026-10-27]: «Editar» de Gestión → Actividades (Práctica, Diálogos) en Next.js — antes abría el editor del remoto Angular (otra interfaz)
// MISMA interfaz que Recursos/«Crear actividad»: pasos numerados (Step), tema con <select> (TopicSelect), filas en tarjetas (DraftEditor), toast al guardar y vuelta a la revisión
// [Patrón]: Controlled Form + Strategy (ACTIVITY_KINDS[kind].edit) + Server Action (diff en el servidor) | [Principio]: DRY (mismas piezas y reglas que crear) + OCP (un tipo editable = una `edit` en la estrategia)
// [A11y]: <label> asociados, errores en role="alert", botón con aria-busy | El idioma no se cambia (el contenido está en ese idioma)

let seq = 0; // Contador de filas → `key` estable de React (UID)
const withUid = (e: Entry): Entry => ({ ...e, [UID]: e[UID] ?? `e${++seq}` });

export interface ActivityEditFormProps {
  kind: CreatableKind;
  id: string;
  initial: ActivityDraft;
  ctx: KindContext;
  languageName: string;
  backHref: string; // Página de revisión (vista previa + Publicar)
}

export function ActivityEditForm({ kind, id, initial, ctx: initialCtx, languageName, backHref }: ActivityEditFormProps) {
  const s = ACTIVITY_KINDS[kind];
  const strategy = { ...s, entry: s.edit?.entry ?? s.entry }; // Diálogos: + IPA y traducción por turno
  const { show, dialog } = useResultDialog(); // [Modal]: éxito → Continuar → revisión · error → se corrige aquí
  const [draft, setDraft] = useState<ActivityDraft>(() => ({ ...initial, entries: initial.entries.map(withUid) })); // `useState(() => …)`: perezoso
  const [level, setLevel] = useState(initialCtx.level);
  const [customTopic, setCustomTopic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [pending, startTransition] = useTransition(); // `useTransition` (React 18+): la Server Action corre sin bloquear la UI

  const ctx = { language: initialCtx.language, level };
  const problems = validateDraft(kind, draft, ctx);
  const src = ACTIVITY_TOPIC_SOURCE[kind];
  const catalog = useCatalogTopics({ language: ctx.language as Language | "", level: level as CefrLevel | "", skill: src?.skill ?? "", kind: src?.kind ?? "exercise" });
  const groups = topicGroups(activityCurated(kind, ctx.language as Language | "", level as CefrLevel | ""), catalog);
  const setMeta = (key: string, v: string) => setDraft((d) => ({ ...d, meta: { ...d.meta, [key]: v } }));

  const save = () => {
    setTried(true);
    if (problems.length) return;
    startTransition(async () => {
      setError(null);
      const res = await updateActivityAction(kind, id, ctx, draft);
      if (!res.ok) {
        show({ ok: false, message: `No se pudo guardar la actividad: ${res.message}` }); // [Error]: modal + aviso en línea (como Recursos)
        return setError(res.message);
      }
      // [Post/Redirect/Get]: al pulsar Continuar vuelve a la revisión (ya revalidada por la acción) con el estado de publicación intacto
      show({ ok: true, message: `«${draft.title.trim()}» se actualizó con éxito.` }, backHref);
    });
  };

  return (
    <div className="space-y-5">
      <ResultDialog {...dialog} /> {/* [Modal de resultado]: controlado por useResultDialog */}
      <Step n={1} title={`Datos · ${s.label}`} hint={kind === "polyglot" ? "Elige los idiomas que se comparan; el nivel se ajusta al elegir el tema." : `Idioma: ${languageName} (no se cambia: el contenido está en este idioma).`} invalid={tried && problems.length > 0}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TopicSelect id="edit-topic" value={draft.title} custom={customTopic} onChange={(topic, custom) => { setCustomTopic(custom); setDraft((d) => ({ ...d, title: topic })); }} groups={groups} ready language={ctx.language as Language} invalid={tried && draft.title.trim().length < 2} level={level as CefrLevel | ""} onLevelChange={setLevel} />
          </div>
          {kind === "polyglot" && (
            <div className="sm:col-span-2">
              <LanguageChecks value={polyLangs(draft.meta)} onChange={(v) => setMeta("languages", v.join(","))} />
            </div>
          )}
          <div>
            <label htmlFor="edit-level" className="mb-1 block text-xs font-semibold text-muted-foreground">
              Nivel <span className="req" aria-hidden>*</span>
            </label>
            <select id="edit-level" required value={level} onChange={(e) => setLevel(e.target.value)} className="control w-full" aria-invalid={(tried && !level) || undefined}>
              <option value="">Elige nivel…</option>
              {LEVEL_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          {s.meta.filter((f) => fieldApplies(f, draftOrigin(draft), draft.meta)).map((f) => (
            <FieldInput key={f.key} id={`edit-meta-${f.key}`} field={f} value={draft.meta[f.key] ?? ""} onChange={(v) => setMeta(f.key, v)} />
          ))}
        </div>
      </Step>

      <Step n={2} title={`${s.entriesTitle} (${draft.entries.length})`} hint="Cambia, añade o quita filas. Al guardar solo se envía lo que cambió.">
        <DraftEditor strategy={strategy} meta={draft.meta} entries={draft.entries} onChange={(entries) => setDraft((d) => ({ ...d, entries }))} />
        <button type="button" className="btn btn-outline w-fit" onClick={() => setDraft((d) => ({ ...d, entries: [...d.entries, withUid(s.emptyEntry())] }))}>
          <Plus aria-hidden className="size-4" /> Añadir {s.entryLabel.toLowerCase()}
        </button>
      </Step>

      {(error || (tried && problems.length > 0)) && (
        <div role="alert" className="rounded-lg border border-tone-danger-line bg-tone-danger-soft p-3 text-sm text-tone-danger">
          {error && <p>{error}</p>}
          {tried && problems.length > 0 && (
            <ul className="list-inside list-disc type-meta">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {/* [Acciones]: «Cancelar» a la izquierda del principal (mismo orden que Recursos y «Crear actividad») */}
      <div className="flex flex-wrap justify-end gap-2">
        <Link href={backHref} className="btn btn-ghost">
          Cancelar
        </Link>
        <button type="button" className="btn btn-primary" disabled={pending} aria-busy={pending} onClick={save}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
