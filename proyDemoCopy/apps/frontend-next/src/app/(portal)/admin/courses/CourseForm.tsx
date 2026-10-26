"use client"; // [Next.js]: Client Component → useActionState e interactividad del formulario
import { Clapperboard, CreditCard, Gift, Link2, Sparkles } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { startTransition, useActionState, useRef, useState, type FocusEvent } from "react"; // [React 19]: conecta el <form> con la Server Action y expone estado + pending
import { useRouter } from "next/navigation"; // [Next.js]: navegación al terminar las subidas
import { Input } from "@/components/ui/input"; // [Atomic Design]: átomo accesible (estilos aria-invalid)
import { Label } from "@/components/ui/label"; // [Atomic Design]: <label> asociado por htmlFor
import { usePreferences } from "@/components/layout/PreferencesProvider";
import {
  COURSE_LABS,
  COURSE_MODALITIES,
  COURSE_TAGS,
  DEFAULT_COURSE_HOURS,
  LANGUAGE_GROUPS,
  MATERIAL_ACCEPT,
  MAX_MATERIAL_MB,
  materialKindOf,
  materialMime,
  MATERIAL_ICON,
  type CourseMaterial,
  type CourseResponse,
} from "@/types/courses";
import { addLinkMaterial, uploadMaterial } from "@/lib/materials-client";
import { CourseSyllabusEditor } from "@/components/courses/CourseSyllabusEditor"; // [2026-10-25]: temario = subtemas (IA, a mano o importando)
import { parseSyllabus, type SyllabusTopic } from "@/lib/syllabus";
import { slugify } from "@/lib/slug"; // [Slug automático]: mismo algoritmo que el backend
import { fmt } from "@aula/shared-i18n";
import { ResultDialog, type SaveResult } from "@/components/shared/ResultDialog"; // [Modal de resultado]: éxito / error al guardar
import { saveCourseAction, type CourseFormState } from "./actions";
import { CEFR_LEVELS } from "@/lib/constants"; // [SSOT niveles MCER]: misma lista en todo el frontend | [Principio]: DRY
// [CourseForm]: formulario ÚNICO de alta y edición de curso (con `initial` edita, sin él crea) | [Patrón]: Presentational + Controlled-by-server | [Principio]: SRP + DRY (un solo formulario) + KISS | [Paradigma]: Declarativo

const INITIAL_STATE: CourseFormState = { status: "idle" }; // Fuera del componente: no se recrea en cada render

// [Material pendiente]: archivo elegido o enlace externo + título + progreso de subida | [2026-10-23]: `url` → material tipo enlace
interface PendingMaterial {
  key: string; // Clave estable para React
  file?: File; // `?` (TS): ausente en los enlaces
  url?: string;
  title: string;
  progress: number; // 0–100
}
const controlClass = "control w-full"; // [Clase compartida de <select>/<textarea>]: mismo look que el átomo Input | [Principio]: DRY

export interface CourseFormProps {
  initial?: CourseResponse; // `?` (TS): presente → modo edición
  initialMaterials?: CourseMaterial[]; // Materiales ya subidos (solo edición)
}

export function CourseForm({ initial, initialMaterials = [] }: CourseFormProps) {
  const { t } = usePreferences();
  const f = t.adminCourses.fields; // Alias corto de etiquetas
  const router = useRouter();
  const m = t.adminCourses.materials;
  const isEdit = Boolean(initial);
  const [materials, setMaterials] = useState<PendingMaterial[]>([]);
  const [existing, setExisting] = useState<CourseMaterial[]>(initialMaterials);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [uploadStep, setUploadStep] = useState<{ n: number; total: number } | null>(null);
  // [Slug automático]: sigue al título hasta que el usuario lo edita a mano; en edición se conserva (no rompe URLs ya compartidas)
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  // [Gratuito / De pago]: controla si se muestran los precios
  const [access, setAccess] = useState<"free" | "paid">(initial?.isFree ? "free" : "paid");
  const [result, setResult] = useState<SaveResult | null>(null); // [Diálogo de resultado]: null = cerrado
  const r = t.common.result;
  const ai = t.adminCourses.ai;
  // [2026-10-23]: refs a campos no controlados → la IA y la importación los rellenan sin volverlos controlados | `useRef` (React)
  const formRef = useRef<HTMLFormElement>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [aiTopic, setAiTopic] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // [Temario · 2026-10-25]: lista de SUBTEMAS (antes un único Markdown donde la IA mezclaba presentación, objetivos y temario) | se guarda como «## Subtema» en `content`
  const [topics, setTopics] = useState<SyllabusTopic[]>(() => parseSyllabus(initial?.content));
  // [Idioma del contenido]: sigue al <select name="group"> → OCR, transcripción e IA en el idioma correcto | `toLowerCase`: "EN" → "en" (ISO 639-1)
  const [language, setLanguage] = useState((initial?.group ?? "EN").toLowerCase());
  const getLevel = () => String(new FormData(formRef.current ?? undefined).get("category") ?? "A1");

  // [setField]: escribe en un control del form por `name` (inputs no controlados) | `namedItem` (DOM)
  const setField = (name: string, value: string) => {
    const el = formRef.current?.elements.namedItem(name);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.value = value;
  };

  // [generateWithAi · 2026-10-25]: POST /api/courses/draft → título, PRESENTACIÓN, objetivos, a quién va dirigido, etiquetas y el TEMARIO (lista de subtemas)
  // Los subtemas llegan con título; cada uno se explica después con «Explicar con IA» (definición, uso, reglas, ejemplos) | [Patrón]: Command + Adapter
  const generateWithAi = async () => {
    const form = formRef.current;
    if (!form) return;
    setAiBusy(true);
    setAiMsg(null);
    try {
      const res = await fetch("/api/courses/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, level: getLevel(), topic: aiTopic.trim() || undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as { title?: string; description?: string; objectives?: string; audience?: string; topics?: string[]; tags?: string[]; message?: string };
      if (!res.ok || !body.title) throw new Error(body.message ?? `HTTP ${res.status}`);
      setField("title", body.title);
      if (!slugTouched) setSlug(slugify(body.title));
      setField("description", body.description ?? "");
      setField("objectives", body.objectives ?? "");
      setField("audience", body.audience ?? "");
      // Subtemas nuevos al final (sin duplicar los que ya están)
      const have = new Set(topics.map((x) => x.title.toLowerCase()));
      setTopics((prev) => [...prev, ...(body.topics ?? []).filter((x) => !have.has(x.toLowerCase())).map((title) => ({ title, body: "" }))]);
      // [Etiquetas]: solo las de la lista cerrada (COURSE_TAGS) | `toLowerCase` → comparación sin mayúsculas
      const wanted = new Set((body.tags ?? []).map((x) => x.toLowerCase()));
      form.querySelectorAll<HTMLInputElement>('input[name="tags"]').forEach((cb) => (cb.checked = cb.checked || wanted.has(cb.value.toLowerCase())));
      setAiMsg({ ok: true, text: ai.done });
    } catch (err) {
      setAiMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setAiBusy(false);
    }
  };

  // [addLink]: enlace externo a la lista de pendientes (se guarda con el curso) | `URL.canParse` (Web API) valida
  const addLink = () => {
    const url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url) || !URL.canParse(url)) return setFileErrors([m.linkInvalid]);
    setFileErrors([]);
    setMaterials((prev) => [...prev, { key: crypto.randomUUID(), url, title: new URL(url).hostname.replace(/^www\./, ""), progress: 0 }]);
    setLinkUrl("");
  };

  // [Acción compuesta]: 1) Server Action guarda el curso · 2) el navegador sube cada material con progreso · 3) navega al listado | [Patrón]: Pipeline + Decorator de la Server Action
  const submit = async (prev: CourseFormState, formData: FormData): Promise<CourseFormState> => {
    const res = await saveCourseAction(prev, formData);
    const title = String(formData.get("title") ?? "");
    if (res.status !== "success" || !res.id) {
      // [Error]: validación o backend → modal con el motivo (los campos marcados siguen visibles detrás)
      if (res.status === "error") setResult({ ok: false, message: fmt(r.courseError, { reason: res.message ?? "" }) });
      return res;
    }
    const failed: string[] = [];
    for (const [i, item] of materials.entries()) {
      setUploadStep({ n: i + 1, total: materials.length });
      try {
        // [Strategy]: enlace → POST JSON · archivo → subida con progreso
        if (item.url) await addLinkMaterial(res.id, item.url, item.title);
        else if (item.file) await uploadMaterial(res.id, item.file, item.title, (pct) => setMaterials((prevList) => prevList.map((x) => (x.key === item.key ? { ...x, progress: pct } : x))));
      } catch (err) {
        failed.push(`${item.file?.name ?? item.url} (${err instanceof Error ? err.message : String(err)})`); // Nombre + motivo real del backend; el curso ya existe
      }
    }
    setUploadStep(null);
    if (failed.length) {
      const message = fmt(m.partialFail, { names: failed.join(", ") });
      setResult({ ok: false, message });
      return { status: "error", id: res.id, message };
    }
    // [Éxito]: se muestra el modal; la navegación al listado ocurre al cerrarlo (onCloseResult)
    setResult({ ok: true, message: fmt(isEdit ? r.courseUpdated : r.courseCreated, { title }) });
    return res;
  };
  const [state, formAction, pending] = useActionState(submit, INITIAL_STATE);

  // [Cerrar modal]: tras un éxito vuelve al listado; tras un error se queda para corregir
  const onCloseResult = () => {
    const ok = result?.ok;
    setResult(null);
    if (ok) {
      // [2026-10-25]: como en Recursos → al detalle del curso para revisarlo y publicarlo (antes volvía al listado)
      router.push(state.id ? `/courses/${state.id}` : "/admin/courses");
      router.refresh();
    }
  };

  // [Elegir archivos]: valida tipo (MIME o extensión → los PDF sin tipo también entran) y tamaño antes de subir | `Array.from` (ES2015): FileList → array
  const addFiles = (list: FileList | null) => {
    const errs: string[] = [];
    const ok: PendingMaterial[] = [];
    for (const file of Array.from(list ?? [])) {
      if (!materialMime(file)) errs.push(fmt(m.badType, { name: file.name }));
      else if (file.size > MAX_MATERIAL_MB * 1024 * 1024) errs.push(fmt(m.tooBig, { name: file.name, mb: MAX_MATERIAL_MB }));
      // `crypto.randomUUID` (Web Crypto): clave única | título por defecto = nombre sin extensión
      else ok.push({ key: crypto.randomUUID(), file, title: file.name.replace(/\.[^.]+$/, ""), progress: 0 });
    }
    setFileErrors(errs);
    setMaterials((prev) => [...prev, ...ok]);
  };

  // [Quitar material ya subido]: DELETE al BFF y se retira de la lista (solo edición)
  const removeExisting = async (mat: CourseMaterial) => {
    const res = await fetch(`/api/courses/${encodeURIComponent(mat.courseId)}/materials/${encodeURIComponent(mat.id)}`, { method: "DELETE" });
    if (res.ok) setExisting((prev) => prev.filter((x) => x.id !== mat.id));
    else setFileErrors([`HTTP ${res.status}`]);
  };

  const errors = state.fieldErrors ?? {}; // `??` (ES2020): sin errores → objeto vacío

  // [a11y]: props comunes de campo inválido → aria-invalid + aria-describedby enlazado al mensaje | [Principio]: DRY
  const invalid = (name: keyof typeof errors) =>
    errors[name] ? { "aria-invalid": true as const, "aria-describedby": `${name}-error` } : {};

  // [fieldError]: función (no componente) que devuelve el mensaje bajo el campo → no se re-monta en cada render | closure sobre `errors`
  const fieldError = (name: keyof typeof errors) =>
    errors[name] ? (
      <p id={`${name}-error`} className="text-xs text-destructive">
        {errors[name]}
      </p>
    ) : null;

  // [Precio: 0 se borra al enfocar]: se escribe directamente sin borrar el cero a mano | `select()` no sirve en type=number en todos los navegadores
  const clearZero = (e: FocusEvent<HTMLInputElement>) => {
    if (Number(e.currentTarget.value) === 0) e.currentTarget.value = "";
  };

  return (
    // [onSubmit + startTransition]: evita el reseteo automático del <form action> de React 19 → los datos no se pierden si hay errores | noValidate: la validación la hace Zod en servidor
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget); // [FormData] (Web API): lee todos los campos con name
        startTransition(() => formAction(data));
      }}
      noValidate
      className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <ResultDialog result={result} onClose={onCloseResult} />
      {state.message && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.message}
        </p>
      )}

      {/* [Responsive]: 1 columna en móvil, 2 desde sm (Tailwind mobile-first) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="title">{f.title} *</Label>
          <Input
            id="title"
            name="title"
            maxLength={200}
            required
            defaultValue={initial?.title}
            onChange={(e) => !slugTouched && setSlug(slugify(e.target.value))} // Slug en vivo mientras no se toque a mano
            {...invalid("title")}
          />
          {fieldError("title")}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="slug">{f.slug}</Label>
          <Input
            id="slug"
            name="slug"
            maxLength={220}
            placeholder="ingles-a1-fundamentos"
            value={slug}
            onChange={(e) => {
              setSlugTouched(e.target.value !== ""); // Vaciarlo vuelve al modo automático
              setSlug(e.target.value);
            }}
            aria-describedby="slug-hint"
            {...invalid("slug")}
          />
          <p id="slug-hint" className="text-xs text-muted-foreground">{f.slugHint}</p>
          {fieldError("slug")}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="group">{f.language} *</Label>
          <select id="group" name="group" defaultValue={initial?.group ?? "EN"} onChange={(e) => setLanguage(e.target.value.toLowerCase())} className={controlClass} {...invalid("group")}>
            {/* [Opciones del SSOT de idiomas]: nombres traducidos */}
            {LANGUAGE_GROUPS.map((g) => (
              <option key={g} value={g}>
                {t.languageNames[g] ?? g}
              </option>
            ))}
          </select>
          {fieldError("group")}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category">{f.level} *</Label>
          <select id="category" name="category" defaultValue={initial?.category ?? "A1"} className={controlClass} {...invalid("category")}>
            {CEFR_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          {fieldError("category")}
        </div>

        {/* [IA · 2026-10-25]: tras elegir idioma y nivel → rellena la ficha (presentación, objetivos, público) y el TEMARIO (subtemas) */}
        <fieldset className="space-y-2 rounded-xl border border-dashed border-tone-brand-line bg-tone-brand-soft p-4 sm:col-span-2" aria-busy={aiBusy}>
          <legend className="px-1 text-sm font-semibold"><Sparkles aria-hidden className="inline size-4 align-[-0.125em]" /> {ai.title}</legend>
          <p className="text-xs text-muted-foreground">{ai.hint}</p>
          <div className="flex flex-wrap gap-2">
            <Label htmlFor="aiTopic" className="sr-only">{ai.topic}</Label>
            <Input id="aiTopic" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder={ai.topicPlaceholder} maxLength={200} className="min-w-48 flex-1" />
            <button type="button" className="btn btn-primary btn-sm" disabled={aiBusy || pending} onClick={() => void generateWithAi()}>
              {aiBusy ? ai.running : ai.run}
            </button>
          </div>
          {aiMsg && (
            <p role={aiMsg.ok ? "status" : "alert"} aria-live="polite" className={`text-xs font-semibold ${aiMsg.ok ? "text-tone-brand" : "text-tone-danger"}`}>
              {aiMsg.text}
            </p>
          )}
        </fieldset>

        {/* [Ficha del curso · 2026-10-25]: presentación (descripción), objetivos y a quién va dirigido → separados del temario */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="description">Presentación *</Label>
          <textarea id="description" name="description" rows={4} maxLength={4000} required defaultValue={initial?.description ?? initial?.shortDescription} aria-describedby="description-hint" className={controlClass} {...invalid("description")} />
          <p id="description-hint" className="text-xs text-muted-foreground">{f.descriptionHint}</p>
          {fieldError("description")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="objectives">Objetivos</Label>
          <textarea id="objectives" name="objectives" rows={5} maxLength={4000} defaultValue={initial?.objectives ?? ""} placeholder="- Presentarte y saludar&#10;- Hablar de tu rutina…" className={controlClass} {...invalid("objectives")} />
          {fieldError("objectives")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audience">A quién va dirigido</Label>
          <textarea id="audience" name="audience" rows={5} maxLength={4000} defaultValue={initial?.audience ?? ""} className={controlClass} {...invalid("audience")} />
          {fieldError("audience")}
        </div>

        {/* [Temario · 2026-10-25]: subtemas con su explicación (IA, a mano o importando) → `content` | los archivos van en «Recursos del curso» */}
        <div className="sm:col-span-2">
          <CourseSyllabusEditor name="content" topics={topics} onChange={setTopics} language={language} getLevel={getLevel} />
          {fieldError("content")}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="instructor">{f.instructor} *</Label>
          <Input id="instructor" name="instructor" maxLength={120} required defaultValue={initial?.instructor} {...invalid("instructor")} />
          {fieldError("instructor")}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="instructorTitle">{f.instructorTitle}</Label>
          <Input id="instructorTitle" name="instructorTitle" maxLength={160} defaultValue={initial?.instructorTitle ?? ""} {...invalid("instructorTitle")} />
          {fieldError("instructorTitle")}
        </div>

        {/* [Tipo de curso]: radios nativos (fieldset + legend = grupo accesible) | gratuito oculta los precios */}
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-sm font-medium">{f.access} *</legend>
          <div className="flex flex-wrap gap-2">
            {(["paid", "free"] as const).map((a) => (
              <label key={a} className="chip has-[:checked]:border-transparent has-[:checked]:bg-gradient-brand has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                <input type="radio" name="access" value={a} checked={access === a} onChange={() => setAccess(a)} className="sr-only" />
                {a === "paid" ? <><CreditCard aria-hidden className="inline size-4 align-[-0.125em]" /> {f.accessPaid}</> : <><Gift aria-hidden className="inline size-4 align-[-0.125em]" /> {f.accessFree}</>}
              </label>
            ))}
          </div>
        </fieldset>

        {access === "paid" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="price">{f.price} *</Label>
              {/* inputMode="decimal": teclado numérico en móvil | step 0.01 = centavos | onFocus: el 0 se borra para escribir */}
              <Input id="price" name="price" type="number" min={0} step="0.01" defaultValue={initial?.price ?? 0} inputMode="decimal" onFocus={clearZero} {...invalid("price")} />
              {fieldError("price")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="originalPrice">{f.originalPrice}</Label>
              <Input id="originalPrice" name="originalPrice" type="number" min={0} step="0.01" defaultValue={initial?.originalPrice ?? ""} inputMode="decimal" onFocus={clearZero} {...invalid("originalPrice")} />
              {fieldError("originalPrice")}
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="durationHours">{f.durationHours}</Label>
          <Input id="durationHours" name="durationHours" type="number" min={1} step={1} defaultValue={initial?.durationHours ?? DEFAULT_COURSE_HOURS} inputMode="numeric" aria-describedby="duration-hint" {...invalid("durationHours")} />
          <p id="duration-hint" className="text-xs text-muted-foreground">{f.durationHint}</p>
          {fieldError("durationHours")}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="modality">{f.modality}</Label>
          {/* [Select]: valores canónicos del SSOT */}
          <select id="modality" name="modality" defaultValue={initial?.modality ?? "Online"} className={controlClass} {...invalid("modality")}>
            {COURSE_MODALITIES.map((mod) => (
              <option key={mod} value={mod}>
                {mod}
              </option>
            ))}
          </select>
          {fieldError("modality")}
        </div>

        {/* [Etiquetas]: casillas de una lista cerrada (fieldset + legend = grupo accesible) | `name="tags"` repetido → FormData.getAll */}
        <fieldset className="space-y-2 sm:col-span-2" aria-describedby="tags-hint">
          <legend className="text-sm font-medium">{f.tags}</legend>
          <p id="tags-hint" className="text-xs text-muted-foreground">{f.tagsHint}</p>
          <div className="flex flex-wrap gap-2">
            {COURSE_TAGS.map((tag) => (
              <label key={tag} className="chip has-[:checked]:border-transparent has-[:checked]:bg-gradient-brand has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                {/* `sr-only`: la casilla sigue siendo accesible (teclado/lector); el chip es su representación visual */}
                <input type="checkbox" name="tags" value={tag} defaultChecked={initial?.tags.includes(tag)} className="sr-only" />
                {tag}
              </label>
            ))}
          </div>
          {fieldError("tags")}
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="lab">{f.lab}</Label>
          {/* [Select de laboratorio]: opciones cerradas + "Sin laboratorio" | un valor antiguo fuera de la lista se conserva como opción */}
          <select id="lab" name="lab" defaultValue={initial?.lab ?? ""} aria-describedby="lab-hint" className={controlClass} {...invalid("lab")}>
            <option value="">{f.labNone}</option>
            {[...COURSE_LABS, ...(initial?.lab && !(COURSE_LABS as readonly string[]).includes(initial.lab) ? [initial.lab] : [])].map((lab) => (
              <option key={lab} value={lab}>
                {lab}
              </option>
            ))}
          </select>
          <p id="lab-hint" className="text-xs text-muted-foreground">{f.labHint}</p>
          {fieldError("lab")}
        </div>
      </div>

      {/* [Checkboxes nativos]: accesibles por defecto (teclado + lector) | accent-color tiñe el check con el primario */}
      <fieldset className="flex flex-col gap-2 sm:flex-row sm:gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isProBono" defaultChecked={initial?.isProBono} className="size-4 accent-primary" />
          {f.isProBono}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPublished" defaultChecked={initial?.isPublished ?? false} /* [2026-10-25]: todo nace en borrador; se publica tras revisarlo */ className="size-4 accent-primary" />
          {f.isPublished}
        </label>
      </fieldset>

      {/* [Material del curso]: el <input type="file"> NO tiene `name` → los archivos no viajan en la Server Action (se suben aparte en streaming) */}
      <fieldset className="space-y-3 rounded-xl border border-dashed border-tone-brand-line bg-tone-brand-soft p-4" aria-describedby="materials-hint">
        <legend className="px-1 text-sm font-semibold"><Clapperboard aria-hidden className="inline size-4 align-[-0.125em]" /> {m.title}</legend>
        <p id="materials-hint" className="text-xs text-muted-foreground">
          {fmt(m.hint, { mb: MAX_MATERIAL_MB })}
        </p>
        {(existing.length > 0 || materials.length > 0) && (
          <ul className="space-y-2">
            {/* [Ya subidos]: solo edición → se pueden quitar */}
            {existing.map((mat) => (
              <li key={mat.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
                <span aria-hidden className="text-lg">
                  {MATERIAL_ICON[mat.kind]}
                </span>
                <span className="min-w-40 flex-1 truncate text-sm">{mat.title}</span>
                <span className="eeg-mono max-w-48 truncate text-[11px] text-muted-foreground">{mat.kind === "link" ? mat.url : `${(mat.sizeBytes / 1024 / 1024).toFixed(1)} MB`}</span>
                <button type="button" onClick={() => void removeExisting(mat)} disabled={pending} aria-label={fmt(m.remove, { name: mat.title })} className="btn btn-ghost btn-sm px-2! text-tone-danger">
                  ✕
                </button>
              </li>
            ))}
            {materials.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
                <span aria-hidden className="text-lg">
                  {/* [Icono]: enlace o tipo deducido del MIME (materialKindOf, SSOT en types/courses) */}
                  {MATERIAL_ICON[item.url ? "link" : materialKindOf(item.file && materialMime(item.file))]}
                </span>
                <label className="sr-only" htmlFor={`mat-${item.key}`}>
                  {m.titleLabel}
                </label>
                <input
                  id={`mat-${item.key}`}
                  value={item.title}
                  maxLength={200}
                  onChange={(e) => setMaterials((prev) => prev.map((x) => (x.key === item.key ? { ...x, title: e.target.value } : x)))}
                  className="control min-w-40 flex-1"
                />
                {/* `toFixed(1)` (JS): tamaño legible en MB */}
                <span className="eeg-mono max-w-48 truncate text-[11px] text-muted-foreground">{item.file ? `${(item.file.size / 1024 / 1024).toFixed(1)} MB` : item.url}</span>
                {pending && item.progress > 0 ? (
                  <progress value={item.progress} max={100} className="h-2 w-24 accent-primary" aria-label={`${item.title} ${item.progress}%`} />
                ) : (
                  <button type="button" onClick={() => setMaterials((prev) => prev.filter((x) => x.key !== item.key))} aria-label={fmt(m.remove, { name: item.file?.name ?? item.url ?? "" })} className="btn btn-ghost btn-sm px-2! text-tone-danger">
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {fileErrors.map((e) => (
          <p key={e} role="alert" className="text-xs text-tone-danger">
            {e}
          </p>
        ))}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="btn btn-outline btn-sm cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
            {m.add}
            <input type="file" accept={MATERIAL_ACCEPT} multiple className="sr-only" disabled={pending} onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = ""; // Permite volver a elegir el mismo archivo
            }} />
          </label>
          {/* [Enlace externo · 2026-10-23]: Enter añade sin enviar el formulario del curso */}
          <div className="flex flex-1 gap-2">
            <label htmlFor="material-link" className="sr-only">{m.linkLabel}</label>
            <input id="material-link" type="url" inputMode="url" value={linkUrl} placeholder={m.linkLabel} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }} className="control min-w-0 flex-1" disabled={pending} />
            <button type="button" className="btn btn-outline btn-sm" onClick={addLink} disabled={pending || !linkUrl.trim()}>
              <Link2 aria-hidden className="size-4" /> {m.linkAdd}
            </button>
          </div>
        </div>
      </fieldset>

      {uploadStep && (
        <p role="status" aria-live="polite" className="text-sm font-semibold text-tone-brand">
          {fmt(m.uploading, { n: uploadStep.n, total: uploadStep.total })}
        </p>
      )}

      <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-primary btn-lg w-full sm:w-auto">
        {isEdit ? (pending ? t.adminCourses.submittingEdit : t.adminCourses.submitEdit) : pending ? t.adminCourses.submitting : t.adminCourses.submit}
      </button>
    </form>
  );
}
