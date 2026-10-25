"use client"; // [Next.js]: Client Component → subida/borrado de material (ADMIN) sin recargar
import { useState } from "react";
import Link from "next/link";
import { usePreferences } from "@/components/layout/PreferencesProvider";
import { uploadMaterial } from "@/lib/materials-client";
import { fmt } from "@aula/shared-i18n";
import { SyllabusList } from "@/components/courses/SyllabusList";
import { lessonHref, MATERIAL_ACCEPT, MAX_MATERIAL_MB, nextPendingIndex, type CourseMaterial } from "@/types/courses";
// [CourseMaterials]: Temario del curso en el detalle, como openCourseDetail del demo → tarjeta "Temario" (Completado / En curso / Bloqueado) + tarjeta "Recursos" + botón Iniciar/Continuar/Repasar
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

export function CourseMaterials({ courseId, initial, initialCompleted, canTrack, canManage, color }: CourseMaterialsProps) {
  const { t } = usePreferences();
  const m = t.courses.materials;
  const [items, setItems] = useState<CourseMaterial[]>(initial);
  const [progress, setProgress] = useState<number | null>(null); // Subida en curso (0–100) o null
  const [error, setError] = useState<string | null>(null);

  const done: ReadonlySet<string> = new Set(initialCompleted); // `Set` (ES2015): pertenencia O(1)
  const completed = items.filter((x) => done.has(x.id)).length;
  const pct = items.length ? Math.round((completed / items.length) * 100) : 0;
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

  return (
    <section aria-labelledby="materials-title" className="scroll-mt-4 space-y-4">
      <h2 id="materials-title" className="text-base font-bold">
        {m.title}
      </h2>

      {items.length === 0 ? (
        <p className="surface p-5 text-sm text-muted-foreground">{m.empty}</p>
      ) : (
        // [grid-2 del demo]: Temario | Recursos (apilado en móvil) | Tailwind responsive `lg:`
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <nav aria-label={m.syllabus} className="surface h-fit p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{m.syllabus}</h3>
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

          <aside aria-labelledby="resources-title" className="surface h-fit p-5">
            <h3 id="resources-title" className="mb-3 text-sm font-semibold">
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
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                <span>{m.progressLabel}</span>
                <b className="eeg-mono" style={{ color }}>
                  {pct}%
                </b>
              </div>
              {/* `role="progressbar"` + aria-value* (WAI-ARIA) */}
              <div className="h-2 overflow-hidden rounded-full" style={{ background: `${color}22` }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={m.progressLabel}>
                <div className="h-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
            {/* [Acción principal]: <Link> a la página de la lección (navegación, no botón) */}
            <Link href={lessonHref(courseId, actionItem.id)} className="btn btn-primary mt-4 w-full">
              {actionLabel}
            </Link>
            {!canTrack && <p className="mt-2 text-[11px] text-muted-foreground">{m.adminNoProgress}</p>}
          </aside>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-tone-danger">
          {error}
        </p>
      )}

      {canManage && (
        <div className="surface space-y-1 p-4">
          <p className="text-sm font-semibold">{m.manage}</p>
          <label className="btn btn-primary btn-sm cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
            {progress === null ? `+ ${m.upload}` : fmt(m.uploading, { pct: progress })}
            <input type="file" accept={MATERIAL_ACCEPT} className="sr-only" disabled={progress !== null} onChange={(e) => {
              void onPick(e.target.files?.[0]);
              e.target.value = "";
            }} />
          </label>
          <p className="text-[11px] text-muted-foreground">{fmt(m.uploadHint, { mb: MAX_MATERIAL_MB })}</p>
        </div>
      )}
    </section>
  );
}
