"use client"; // [Next.js]: Client Component → useActionState e interactividad del formulario
import { SOCIAL_META, SOCIAL_NETWORKS, SOCIAL_URL_MAX_LENGTH, socialUrlField, type SocialUrlField } from "@/types/profile"; // [2026-11-03]: perfil del instructor en el curso
import { Clapperboard, CreditCard, FileUp, Gift, Link2, PenLine, Sparkles, type LucideIcon } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis) | [2026-10-27]: + iconos del selector Manual / Importar / IA
import { startTransition, useActionState, useEffect, useRef, useState, type FocusEvent } from "react"; // [React 19]: conecta el <form> con la Server Action y expone estado + pending
import Link from "next/link";
import { useRouter } from "next/navigation"; // [Next.js]: navegación al terminar las subidas
import { Input } from "@/components/ui/input"; // [Atomic Design]: átomo accesible (estilos aria-invalid)
import { Label } from "@/components/ui/label"; // [Atomic Design]: <label> asociado por htmlFor
import { usePreferences } from "@/components/layout/PreferencesProvider";
import {
  COURSE_LABS,
  COURSE_MODALITIES,
  COURSE_TAGS,
  suggestCourseTags,
  MAX_COURSE_TAGS,
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
import { parseSyllabus, splitPresentation, toTopics, type SyllabusTopic } from "@/lib/syllabus";
import { TextImport, type ImportedText } from "@/components/shared/TextImport"; // [2026-10-27]: importar temario/contenido (PDF, Word, URL, YouTube…) — mismo átomo que el resto del portal | [Principio]: DRY
import { readReturn } from "@/components/shared/RememberReturn"; // [2026-10-27]: «Cancelar» vuelve a la pestaña/filtros de origen (igual que «Volver»)
import { slugify } from "@/lib/slug"; // [Slug automático]: mismo algoritmo que el backend
import { fmt } from "@aula/shared-i18n";
import { ResultDialog, type SaveResult } from "@/components/shared/ResultDialog"; // [Modal de resultado]: éxito / error al guardar
import { saveCourseAction, type CourseFormState } from "./actions";
import { CEFR_LEVELS } from "@/lib/constants"; // [SSOT niveles MCER]: misma lista en todo el frontend | [Principio]: DRY
import { syllabusLevel } from "@/config/curriculum-topics"; // [2026-11-09]: nivel según los subtemas
import type { Language } from "@/types/quiz";
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

// [Origen del temario · 2026-10-27]: Manual | Importar | IA (antes solo había «Generar con IA») | `as const` (TS): tupla de literales → tipo unión derivado
const SOURCES = ["manual", "import", "ai"] as const;
type SyllabusSource = (typeof SOURCES)[number]; // [Indexed access type] (TS): "manual" | "import" | "ai" | [Principio]: SSOT
const SOURCE_ICON: Readonly<Record<SyllabusSource, LucideIcon>> = { manual: PenLine, import: FileUp, ai: Sparkles }; // [Patrón]: Lookup Table
const DRAFT_TEXT_MAX = 20_000; // = @MaxLength del DraftCourseDto (NestJS) → lo importado se recorta antes de pedir la ficha a la IA | `20_000` (ES2021): separador numérico

// [InstructorProfile · 2026-11-03]: bio + redes del docente autor (se publican en «Instructor» del curso) | `editable=false`: un ADMIN editando el curso de otro lo ve sin poder cambiarlo
export interface InstructorProfile {
  bio: string;
  social: Partial<Record<SocialUrlField, string | null>>;
  editable: boolean;
}

export interface CourseFormProps {
  instructorProfile?: InstructorProfile;
  initial?: CourseResponse; // `?` (TS): presente → modo edición
  initialMaterials?: CourseMaterial[]; // Materiales ya subidos (solo edición)
}

// [isPlaceholder · 2026-11-02]: subtema creado con «Añadir primer subtema» y nunca rellenado («Subtema 3», sin explicación)
const isPlaceholder = (t: SyllabusTopic) => !t.body.trim() && /^Subtema \d+$/.test(t.title.trim());

export function CourseForm({ initial, initialMaterials = [], instructorProfile }: CourseFormProps) {
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
  const firstInvalidRef = useRef<string | null>(null); // [2026-10-28]: nombre del primer campo con error (para enfocarlo)
  const [linkUrl, setLinkUrl] = useState("");
  const [aiTopic, setAiTopic] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const src = t.adminCourses.source;
  // [Selector de origen · 2026-10-27]: el docente elige cómo construir el temario | por defecto «Manual» (crear subtemas/subcontenidos a mano)
  const [source, setSource] = useState<SyllabusSource>("manual");
  const [imported, setImported] = useState<string>(""); // Último texto importado → base opcional para que la IA complete la ficha
  const [importMsg, setImportMsg] = useState<string | null>(null);
  // [Temario · 2026-10-25]: lista de SUBTEMAS (antes un único Markdown donde la IA mezclaba presentación, objetivos y temario) | se guarda como «## Subtema» en `content`
  const [topics, setTopics] = useState<SyllabusTopic[]>(() => parseSyllabus(initial?.content));
  // [Idioma del contenido]: sigue al <select name="group"> → OCR, transcripción e IA en el idioma correcto | `toLowerCase`: "EN" → "en" (ISO 639-1)
  const [language, setLanguage] = useState((initial?.group ?? "EN").toLowerCase());
  // [2026-11-09 · Nivel según el temario]: nivel controlado → se asigna y evalúa con los subtemas (syllabusLevel)
  const [level, setLevel] = useState<string>(initial?.category ?? "A1");
  const [levelTouched, setLevelTouched] = useState(Boolean(initial)); // Al editar no se cambia solo
  const getLevel = () => level;
  const detected = syllabusLevel(topics.map((x) => x.title), language as Language);
  // [2026-11-10]: el título también lo dice («Alemán A1 · Gramática») y manda sobre el temario
  const levelIn = (t?: string) => t?.match(/\b([ABC][12])\b/i)?.[1]?.toUpperCase() ?? null;
  const [titleLevel, setTitleLevel] = useState(() => levelIn(initial?.title));
  const autoLevel = titleLevel ?? detected?.level ?? null;
  useEffect(() => {
    if (autoLevel && !levelTouched && autoLevel !== level) setLevel(autoLevel); // Curso nuevo: título y temario asignan el nivel hasta que el docente lo cambie a mano
  }, [autoLevel, levelTouched, level]); // eslint-disable-line react-hooks/exhaustive-deps

  // [Etiquetas automáticas · 2026-10-30]: al cambiar el temario (a mano, archivo, enlace o IA) se marcan las que correspondan | solo añade: nunca desmarca lo que eligió el docente
  // `useEffect` (React): las casillas son no controladas → se escribe en el DOM, igual que la IA | [Principio]: DRY (misma lista cerrada COURSE_TAGS)
  useEffect(() => {
    const wanted = new Set(suggestCourseTags(topics.map((x) => `${x.title}\n${x.body}`).join("\n")));
    const boxes = Array.from(formRef.current?.querySelectorAll<HTMLInputElement>('input[name="tags"]') ?? []);
    let free = MAX_COURSE_TAGS - boxes.filter((cb) => cb.checked).length; // [Tope]: el formulario promete «máx. 10»
    for (const cb of boxes) {
      if (free > 0 && !cb.checked && wanted.has(cb.value)) {
        cb.checked = true;
        free--;
      }
    }
  }, [topics]);

  // [setField]: escribe en un control del form por `name` (inputs no controlados) | `namedItem` (DOM)
  const setField = (name: string, value: string) => {
    const el = formRef.current?.elements.namedItem(name);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.value = value;
  };

  // [generateWithAi · 2026-10-25]: POST /api/courses/draft → título, PRESENTACIÓN, objetivos, a quién va dirigido, etiquetas y el TEMARIO (lista de subtemas)
  // Los subtemas llegan con título; cada uno se explica después con «Explicar con IA» (definición, uso, reglas, ejemplos) | [Patrón]: Command + Adapter
  // [2026-10-27]: `opts.text` → la ficha se basa en lo IMPORTADO y NO se añaden subtemas inventados (el temario ya viene del documento) | `opts = {}` (ES2015): parámetro por defecto
  const generateWithAi = async (opts: { text?: string } = {}) => {
    const form = formRef.current;
    if (!form) return;
    setAiBusy(true);
    setAiMsg(null);
    try {
      const res = await fetch("/api/courses/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, level: getLevel(), topic: aiTopic.trim() || undefined, text: opts.text?.slice(0, DRAFT_TEXT_MAX) || undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as { title?: string; description?: string; objectives?: string; audience?: string; topics?: string[]; tags?: string[]; message?: string };
      if (!res.ok || !body.title) throw new Error(body.message ?? `HTTP ${res.status}`);
      setField("title", body.title);
      setTitleLevel(levelIn(body.title));
      if (!slugTouched) setSlug(slugify(body.title));
      setField("description", body.description ?? "");
      setField("objectives", body.objectives ?? "");
      setField("audience", body.audience ?? "");
      // Subtemas nuevos al final (sin duplicar los que ya están)
      const have = new Set(topics.map((x) => x.title.toLowerCase()));
      if (!opts.text) setTopics((prev) => [...prev.filter((t) => !isPlaceholder(t)), ...(body.topics ?? []).filter((x) => !have.has(x.toLowerCase())).map((title) => ({ title, body: "" }))]);
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

  // [onImported · 2026-10-27]: documento/enlace → subtemas y subcontenidos según sus encabezados (lib/syllabus.toTopics) | se AÑADEN al final (se pueden combinar varias fuentes)
  // [importsRef · 2026-10-28]: resultado importado → subtemas que añadió | `WeakMap` (ES2015): la clave es el MISMO objeto que TextImport devuelve en onClear; se libera solo
  const importsRef = useRef(new WeakMap<ImportedText, SyllabusTopic[]>());
  const onImported = (x: ImportedText) => {
    // [Fix 2026-11-05]: la explicación inicial del documento va a «Presentación» (si está vacía) y los subtemas quedan como Tema N / Subtema N.M, igual que con IA o a mano
    const raw = toTopics(x.markdown, x.title || "Material importado");
    const split = splitPresentation(raw);
    const desc = formRef.current?.elements.namedItem("description");
    const canPresent = desc instanceof HTMLTextAreaElement && !desc.value.trim(); // Ya hay presentación → no se pisa: el texto se queda en el temario
    if (split.presentation && canPresent) desc.value = split.presentation.slice(0, 4000);
    const added = split.presentation && !canPresent ? [{ title: "Introducción", body: split.presentation }, ...split.topics] : split.topics; // Presentación ya escrita → la intro queda como primer tema
    importsRef.current.set(x, added);
    setTopics((prev) => [...prev.filter((t) => !isPlaceholder(t)), ...added]); // [Fix 2026-11-02]: los «Subtema N» vacíos se descartan → lo importado queda como tema 1
    setImported((prev) => (prev ? `${prev}\n\n${x.text}` : x.text)); // Acumula para «Completar la ficha con IA»
    setImportMsg(fmt(src.importDone, { n: added.length }));
  };
  // [onImportCleared · 2026-10-28]: «Quitar» el archivo/enlace importado → retira SUS subtemas (por identidad de objeto: los que el docente editó son objetos nuevos y se conservan)
  // y su texto de la base para la IA | [Patrón]: Undo (Memento ligero) | [Principio]: no destruir trabajo del usuario
  const onImportCleared = (x: ImportedText) => {
    const added = new Set(importsRef.current.get(x) ?? []); // `Set` (ES2015): búsqueda O(1)
    const removed = topics.filter((t) => added.has(t)).length;
    setTopics((prev) => prev.filter((t) => !added.has(t)));
    setImported((prev) => prev.replace(x.text, "").trim());
    importsRef.current.delete(x);
    setImportMsg(fmt(src.importCleared, { n: removed }));
  };

  // [startManual · 2026-10-27]: añade un subtema vacío y lleva el foco a su título | `requestAnimationFrame` (Web API): espera a que React pinte el nuevo <input>
  // [Fix 2026-11-02]: el editor está más abajo → antes «no pasaba nada» a la vista y cada clic creaba otro «Subtema N» vacío. Ahora baja al editor
  // y enfoca el título; si ya hay un subtema vacío sin nombrar, reutiliza ese (no duplica)
  const startManual = () => {
    const empty = topics.findIndex(isPlaceholder);
    const i = empty >= 0 ? empty : topics.length;
    if (empty < 0) setTopics((prev) => [...prev, { title: `Subtema ${i + 1}`, body: "" }]);
    requestAnimationFrame(() => {
      const el = document.getElementById(`topic-${i}`) as HTMLInputElement | null;
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
      el?.select();
    });
  };

  // [cancel · 2026-10-27]: vuelve al listado (o a la pestaña/filtros anotados por RememberReturn) sin guardar | [Principio]: consistencia con «Volver»
  const cancel = () => router.push(readReturn("courses") || "/admin/courses");

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
    // [Etiquetas · 2026-10-30]: sin ninguna marcada → se derivan también del título y la presentación (curso manual sin temario) | `FormData.append` (Web API): mismo campo repetido
    if (!formData.getAll("tags").length) suggestCourseTags([formData.get("title"), formData.get("description"), ...topics.map((x) => x.title)].join("\n")).slice(0, MAX_COURSE_TAGS).forEach((tag) => formData.append("tags", tag));
    const res = await saveCourseAction(prev, formData);
    const title = String(formData.get("title") ?? "");
    if (res.status !== "success" || !res.id) {
      // [Error]: validación o backend → modal con el motivo (los campos marcados siguen visibles detrás)
      if (res.status === "error") setResult({ ok: false, message: fmt(r.courseError, { reason: res.message ?? "" }) });
      // [Fix 2026-10-28 · a11y]: errores de campo (p. ej. «Presentación» obligatoria) → se apunta al primero para enfocarlo al cerrar el modal
      firstInvalidRef.current = res.fieldErrors ? (Object.keys(res.fieldErrors)[0] ?? null) : null;
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
    // [Fix 2026-10-28]: tras un error de validación el foco va al primer campo marcado (el mensaje está debajo) | `requestAnimationFrame`: espera a que el modal se cierre
    const invalidName = firstInvalidRef.current;
    if (!ok && invalidName) requestAnimationFrame(() => (formRef.current?.elements.namedItem(invalidName) as HTMLElement | null)?.focus?.());
    if (ok) {
      // [2026-10-25]: como en Recursos → al detalle del curso para revisarlo y publicarlo (antes volvía al listado)
      // [2026-11-09]: crear o editar → al BORRADOR del curso (revisar y publicar); allí está «Crear examen»
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
      <p id={`${name}-error`} className="type-meta text-destructive">
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
      className="space-y-5 surface p-5 sm:p-6"
    >
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <ResultDialog result={result} onClose={onCloseResult} />
      {state.message && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive">
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
            onChange={(e) => { setTitleLevel(levelIn(e.target.value)); if (!slugTouched) setSlug(slugify(e.target.value)); }} // Slug en vivo mientras no se toque a mano
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
          <p id="slug-hint" className="type-meta text-muted-foreground">{f.slugHint}</p>
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
          {/* [2026-11-16 · RF-148]: al CREAR el nivel queda bloqueado (lo asignan el título o el temario) · solo se cambia al editar
              `disabled` (HTML) no se envía en el FormData → el <input type="hidden"> lleva el valor */}
          {!isEdit && <input type="hidden" name="category" value={level} />}
          <select id="category" name={isEdit ? "category" : undefined} value={level} disabled={!isEdit} aria-describedby={isEdit ? undefined : "category-hint"} onChange={(e) => { setLevel(e.target.value); setLevelTouched(true); }} className={controlClass} {...invalid("category")}>
            {CEFR_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          {fieldError("category")}
          {!isEdit && <p id="category-hint" className="type-meta text-muted-foreground">Se asigna solo por el título o el temario; podrás cambiarlo al editar.</p>}
          {/* [Evaluar]: nivel predominante de los subtemas del temario frente al elegido */}
          {detected && (
            <p role="status" className={`type-meta ${detected.level === level ? "text-muted-foreground" : "text-tone-warning"}`}>
              {detected.level === level
                ? `✓ El temario corresponde a ${detected.level} (${detected.matched} subtema${detected.matched === 1 ? "" : "s"} del catálogo).`
                : `⚠ El temario parece de nivel ${detected.level} (${detected.matched} subtema${detected.matched === 1 ? "" : "s"}).`}
              {isEdit && detected.level !== level && (
                <button type="button" className="ml-2 font-semibold text-primary underline" onClick={() => setLevel(detected.level)}>Usar {detected.level}</button>
              )}
            </p>
          )}
        </div>

        {/* [Origen del temario · 2026-10-27]: Manual | Importar | IA (antes solo «Generar con IA») | radios nativos con aspecto de chips (mismo patrón que «Tipo de curso»)
            [a11y]: <fieldset> + <legend> = grupo de radios (flechas del teclado, lector anuncia «1 de 3») · el panel activo se asocia con aria-controls */}
        <fieldset className="space-y-3 rounded-xl border border-dashed border-tone-brand-line bg-tone-brand-soft p-4 sm:col-span-2" aria-busy={aiBusy}>
          <legend className="px-1 text-sm font-semibold">{src.legend}</legend>
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((key) => {
              const Icon = SOURCE_ICON[key];
              return (
                <label key={key} className="chip has-[:checked]:border-transparent has-[:checked]:bg-gradient-brand has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                  {/* `name` común = un solo grupo de radios (flechas del teclado) | «syllabusSource» viaja en el FormData pero la Server Action solo lee sus campos explícitos → se ignora */}
                  <input type="radio" name="syllabusSource" value={key} checked={source === key} onChange={() => setSource(key)} aria-controls="syllabus-source-panel" className="sr-only" />
                  <Icon aria-hidden className="inline size-4 align-[-0.125em]" /> {src[key]}
                </label>
              );
            })}
          </div>

          <div id="syllabus-source-panel" className="space-y-2">
            {/* [Manual]: el temario se escribe en el editor de abajo (subtemas + subcontenidos) */}
            {source === "manual" && (
              <>
                <p className="type-meta text-muted-foreground">{src.manualHint}</p>
                <button type="button" className="btn btn-outline btn-sm" onClick={startManual} disabled={pending}>
                  <PenLine aria-hidden className="size-4" /> {src.manualStart}
                </button>
              </>
            )}

            {/* [Importar]: PDF, Word, Excel, imagen (OCR), audio/video (transcripción), URL o YouTube → subtemas por encabezados | BFF /api/courses/import (tope largo, solo docente/admin) */}
            {source === "import" && (
              <>
                <p className="type-meta text-muted-foreground">{src.importHint}</p>
                <TextImport label={src.importLabel} onText={onImported} onClear={onImportCleared} language={language} endpoint="/api/courses/import" />
                {importMsg && (
                  <p role="status" aria-live="polite" className="type-meta font-semibold text-tone-brand">
                    {importMsg}
                  </p>
                )}
                {imported && (
                  <button type="button" className="btn btn-outline btn-sm" disabled={aiBusy || pending} aria-busy={aiBusy} onClick={() => void generateWithAi({ text: imported })}>
                    <Sparkles aria-hidden className="size-4" /> {aiBusy ? ai.running : src.importAi}
                  </button>
                )}
              </>
            )}

            {/* [IA · 2026-10-25]: tras elegir idioma y nivel → rellena la ficha (presentación, objetivos, público) y el TEMARIO (subtemas) */}
            {source === "ai" && (
              <>
                <p className="type-meta text-muted-foreground">{ai.hint}</p>
                <div className="flex flex-wrap gap-2">
                  <Label htmlFor="aiTopic" className="sr-only">{ai.topic}</Label>
                  <Input id="aiTopic" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder={ai.topicPlaceholder} maxLength={200} className="min-w-48 flex-1" />
                  <button type="button" className="btn btn-primary btn-sm" disabled={aiBusy || pending} onClick={() => void generateWithAi()}>
                    {aiBusy ? ai.running : ai.run}
                  </button>
                </div>
              </>
            )}
            {aiMsg && (
              <p role={aiMsg.ok ? "status" : "alert"} aria-live="polite" className={`text-xs font-semibold ${aiMsg.ok ? "text-tone-brand" : "text-tone-danger"}`}>
                {aiMsg.text}
              </p>
            )}
          </div>
        </fieldset>

        {/* [Ficha del curso · 2026-10-25]: presentación (descripción), objetivos y a quién va dirigido → separados del temario */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="description">Presentación *</Label>
          <textarea id="description" name="description" rows={4} maxLength={4000} required defaultValue={initial?.description ?? initial?.shortDescription} aria-describedby="description-hint" className={controlClass} {...invalid("description")} />
          <p id="description-hint" className="type-meta text-muted-foreground">{f.descriptionHint}</p>
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
          {/* `showImport={false}`: la importación vive en la pestaña «Importar» de arriba (un solo importador) */}
          <CourseSyllabusEditor name="content" topics={topics} onChange={setTopics} language={language} getLevel={getLevel} showImport={false} />
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

        {/* [Perfil del instructor · 2026-11-03]: bio y redes sociales del docente → «Instructor» del detalle del curso | se guardan en SU perfil (mismas reglas que Mi perfil)
            <fieldset>/<legend>: grupo accesible · cada red con su dominio permitido en el placeholder */}
        {instructorProfile && (
          <fieldset className="space-y-3 surface-item sm:col-span-2" aria-describedby="instructor-profile-hint">
            <legend className="px-1 text-sm font-semibold">Perfil del instructor</legend>
            <p id="instructor-profile-hint" className="type-meta text-muted-foreground">
              {instructorProfile.editable
                ? "Se muestra en «Instructor» de todos tus cursos y se guarda en tu perfil. Escribe las redes que quieras mostrar; vacías no aparecen."
                : "Es el perfil del docente que creó el curso; solo él puede cambiarlo desde «Mi perfil»."}
            </p>
            {instructorProfile.editable && <input type="hidden" name="instructorProfile" value="1" />}
            <div className="space-y-1.5">
              <Label htmlFor="instructorBio">Presentación (bio)</Label>
              <textarea id="instructorBio" name="instructorBio" rows={3} maxLength={300} disabled={!instructorProfile.editable} defaultValue={instructorProfile.bio} placeholder="Experiencia, titulación y cómo enseñas (máx. 300 caracteres)" className="control w-full" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {SOCIAL_NETWORKS.map((net) => {
                const field = socialUrlField(net);
                return (
                  <div key={net} className="space-y-1.5">
                    <Label htmlFor={`instructor-${field}`}>{SOCIAL_META[net].label}</Label>
                    <Input id={`instructor-${field}`} name={field} type="url" inputMode="url" maxLength={SOCIAL_URL_MAX_LENGTH} disabled={!instructorProfile.editable} defaultValue={instructorProfile.social[field] ?? ""} placeholder={SOCIAL_META[net].placeholder} {...invalid(field as never)} />
                    {fieldError(field as never)}
                  </div>
                );
              })}
            </div>
          </fieldset>
        )}

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
          <p id="duration-hint" className="type-meta text-muted-foreground">{f.durationHint}</p>
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
          <p id="tags-hint" className="type-meta text-muted-foreground">{f.tagsHint}</p>
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
          <p id="lab-hint" className="type-meta text-muted-foreground">{f.labHint}</p>
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
        <p id="materials-hint" className="type-meta text-muted-foreground">
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
          <p key={e} role="alert" className="type-meta text-tone-danger">
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
        <p role="status" aria-live="polite" className="font-semibold text-tone-brand">
          {fmt(m.uploading, { n: uploadStep.n, total: uploadStep.total })}
        </p>
      )}

      {/* [Examen final · 2026-11-09]: acceso directo a Gestión → Exámenes para crear/editar el examen del curso */}
      <section aria-labelledby="course-exam" className="surface flex flex-wrap items-center gap-3 border-l-4 border-l-primary p-4">
        <div className="min-w-0 flex-1">
          <h2 id="course-exam" className="font-semibold">Examen final del curso</h2>
          <p className="type-meta text-muted-foreground">
            {isEdit
              ? "Crea o revisa el examen que da el certificado. Los alumnos lo ven bloqueado hasta completar el curso al 100 %."
              : "Al guardar el curso lo verás como borrador: junto a Publicar y Editar está «Crear examen» (con el temario del curso ya cargado)."}
          </p>
        </div>
        {isEdit && initial && (
          <Link href={`/quiz/create?curso=${encodeURIComponent(initial.id)}`} className="btn btn-outline btn-sm">
            Gestionar examen →
          </Link>
        )}
      </section>

      {/* [Acciones · 2026-10-27]: «Cancelar» a la IZQUIERDA del botón principal, alineados a la derecha → igual que Actividades, Exámenes, Recursos y Usuarios | [Principio]: consistencia (Jakob's Law)
          Móvil: los dos ocupan el ancho (flex-1) y el principal queda a la derecha */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={cancel} disabled={pending} className="btn btn-ghost btn-lg flex-1 sm:flex-none">
          {t.management.row.cancel}
        </button>
        <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-primary btn-lg flex-1 sm:flex-none">
          {isEdit ? (pending ? t.adminCourses.submittingEdit : t.adminCourses.submitEdit) : pending ? t.adminCourses.submitting : t.adminCourses.submit}
        </button>
      </div>
    </form>
  );
}
