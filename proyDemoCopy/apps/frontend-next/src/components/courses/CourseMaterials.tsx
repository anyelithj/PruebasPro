"use client"; // [Next.js]: Client Component → subida/borrado de material (ADMIN) sin recargar
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom"; // [2026-10-30]: Resumen y Gestionar material se pintan en la columna lateral de la página (Server Component) conservando el estado de aquí
import Link from "next/link";
import { usePreferences } from "@/components/layout/PreferencesProvider";
import { uploadMaterial } from "@/lib/materials-client";
import { fmt } from "@aula/shared-i18n";
import { COURSE_CTA_CLASS } from "@/components/courses/CourseActions";
import { SyllabusList } from "@/components/courses/SyllabusList";
import { ProgressBar } from "@/components/courses/ProgressBar"; // [2026-10-28]: barra única de los cursos (role="progressbar" + aria-valuetext)
import { pctOf } from "@/lib/course-progress";
import { lessonHref, MATERIAL_ACCEPT, MAX_MATERIAL_MB, nextPendingIndex, type CourseMaterial } from "@/types/courses";
// [CourseMaterials]: «Materiales adicionales» del detalle del curso (antes «Recursos del curso», 2026-10-28) → tarjeta de lista (Completado / En curso / Bloqueado) + tarjeta de resumen + botón Iniciar/Continuar/Repasar
// Cada lección se abre en su propia página (/courses/:id/lessons/:mid) — ya no hay visor debajo del detalle del curso
// [Patrón]: Container + Presentational (SyllabusList) | [Principio]: SRP + DRY | [Paradigma]: Reactivo + Declarativo

export interface CourseMaterialsProps {
  courseId: string;
  initial: CourseMaterial[];
  initialCompleted: string[]; // Ids completados (del backend)
  canTrack: boolean; // Inscrito/comprado → se registra el progreso (y aplica el desbloqueo secuencial)
  canManage: boolean; // ADMIN → subir/quitar
  color: string; // Color del idioma del curso
}

export const COURSE_ASIDE_SLOT = "course-aside-slot"; // `id` del hueco en la columna lateral de /courses/:id

export function CourseMaterials({ courseId, initial, initialCompleted, canTrack, canManage, color }: CourseMaterialsProps) {
  const { t } = usePreferences();
  const m = t.courses.materials;
  const [items, setItems] = useState<CourseMaterial[]>(initial);
  const [progress, setProgress] = useState<number | null>(null); // Subida en curso (0–100) o null
  const [error, setError] = useState<string | null>(null);

  const done: ReadonlySet<string> = new Set(initialCompleted); // `Set` (ES2015): pertenencia O(1)
  const completed = items.filter((x) => done.has(x.id)).length;
  const pct = pctOf(completed, items.length); // [DRY]: mismo redondeo/acotado que el resto de barras (lib/course-progress)
  const nextPending = nextPendingIndex(items, done);

  // [Subir]: ADMIN añade material al final del temario
  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      const created = await uploadMaterial(courseId, file, file.name.replace(/\.[^.]+$/, ""), setProgress);
      setItems((prev) => [...prev, created]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  // [Quitar]: DELETE al BFF y se retira de la lista
  const onRemove = async (id: string) => {
    const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}/materials/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) return setError(`HTTP ${res.status}`);
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  // [Recursos]: conteo real por tipo (sin cifras inventadas) | [Principio]: Honestidad de datos
  const countOf = (kind: CourseMaterial["kind"]) => items.filter((x) => x.kind === kind).length;
  const resources: ReadonlyArray<[string, number]> = [
    [m.resVideos, countOf("video")],
    [m.resPdfs, countOf("pdf")],
    [m.resImages, countOf("image")],
    // [2026-10-23]: nuevos tipos (solo se muestran si hay) | `satisfies` (TS 4.9): valida la forma sin perder el tipo
    ...([["Audios", countOf("audio")], ["Documentos", countOf("document")], ["Enlaces", countOf("link")]] satisfies [string, number][]).filter(([, n]) => n > 0),
  ];
  // [Botón de acción]: igual que el demo → Iniciar / Continuar / Repasar según el progreso
  const actionLabel = pct === 100 ? m.review : completed === 0 ? m.start : m.resume;
  const actionItem = items[nextPending === -1 ? 0 : nextPending];
  // [Hueco lateral]: `useEffect`: el nodo solo existe en el cliente | sin él (móvil no aplica: la columna existe siempre) se pinta aquí mismo
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setSlot(document.getElementById(COURSE_ASIDE_SLOT)), []);
  const inAside = (node: ReactNode) => (slot ? createPortal(node, slot) : node);

  return (
    <section aria-labelledby="materials-title" className="scroll-mt-4 space-y-4">
      <h2 id="materials-title" className="title-section">
        {m.title}
      </h2>

      {items.length === 0 ? (
        <p className="surface p-5 text-muted-foreground">{m.empty}</p>
      ) : (
        // [Ancho completo · 2026-10-28]: «Materiales adicionales» ocupa el mismo ancho que «Ruta del curso» → lista y resumen apilados a todo el ancho de la columna principal (antes `xl:grid-cols-2` los partía a la mitad)
        <div className="grid grid-cols-1 gap-4">
          {/* [2026-10-28]: `m.list` («Lista de materiales») en vez de `m.syllabus` («Recursos», que sigue usando la página de la lección) → la sección ya no repite «Recursos» */}
          <nav aria-label={m.list} className="surface h-fit p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="title-card">{m.list}</h3>
              <span className="eeg-mono rounded px-2 py-0.5 text-[11px] font-bold" style={{ background: `${color}18`, color }}>
                {pct}%
              </span>
            </div>
            <SyllabusList
              courseId={courseId}
              items={items}
              done={done}
              activeIndex={nextPending}
              nextPending={nextPending}
              canTrack={canTrack}
              color={color}
              labels={{ done: m.done, current: m.current, locked: m.lockedStep, pending: m.pending, lockedHint: m.lockedHint, remove: m.remove }}
              onRemove={canManage ? (id) => void onRemove(id) : undefined}
            />
          </nav>

          {inAside(<section aria-labelledby="resources-title" className="surface h-fit p-5">
            <h3 id="resources-title" className="title-card mb-3">
              {m.resources}
            </h3>
            {/* [Lista de definición]: <dl> semántico para pares etiqueta → valor (a11y) */}
            <dl className="text-xs">
              {resources.map(([label, n]) => (
                <div key={label} className="flex justify-between border-b border-border py-2">
                  <dt>{label}</dt>
                  <dd className="eeg-mono text-muted-foreground">{n}</dd>
                </div>
              ))}
              <div className="flex justify-between border-b border-border py-2">
                <dt>{m.resDone}</dt>
                <dd className="eeg-mono text-muted-foreground">
                  {completed}/{items.length}
                </dd>
              </div>
            </dl>
            {/* [Fix 2026-10-28]: esta barra cuenta SOLO recursos → se rotula «Recursos completados» (antes «Progreso del curso» con un % distinto al de la cabecera, que suma también subtemas y ruta) | ProgressBar compartida */}
            <ProgressBar className="mt-3" pct={pct} label="Recursos completados" color={color} detail={`${completed} de ${items.length} recursos`} size="sm" />
            {/* [Acción principal]: <Link> a la página de la lección (navegación, no botón) */}
            <Link href={lessonHref(courseId, actionItem.id)} className="btn btn-primary mt-4 w-full">
              {actionLabel}
            </Link>
            {!canTrack && <p className="mt-2 type-meta text-muted-foreground">{m.adminNoProgress}</p>}
          </section>)}
        </div>
      )}

      {error && (
        <p role="alert" className="type-meta text-tone-danger">
          {error}
        </p>
      )}

      {canManage && inAside(
        <div className="surface space-y-1 p-4">
          <p className="font-semibold">{m.manage}</p>
          {/* [Fix 2026-10-31]: mismo ancho y altura que «Iniciar curso» (COURSE_CTA_CLASS) | `block text-center`: un <label> no centra su texto como un <button> */}
          <label className={`${COURSE_CTA_CLASS} block text-center has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring`}>
            {progress === null ? `+ ${m.upload}` : fmt(m.uploading, { pct: progress })}
            <input type="file" accept={MATERIAL_ACCEPT} className="sr-only" disabled={progress !== null} onChange={(e) => {
              void onPick(e.target.files?.[0]);
              e.target.value = "";
            }} />
          </label>
          <p className="type-meta text-muted-foreground">{fmt(m.uploadHint, { mb: MAX_MATERIAL_MB })}</p>
        </div>
      )}
    </section>
  );
}
