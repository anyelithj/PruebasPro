"use client"; // [Next.js]: Client Component → marcar completa (Optimistic UI) y navegación entre lecciones
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/components/layout/PreferencesProvider";
import { completeMaterialAction } from "@/lib/purchase-actions"; // [Server Action]: marca el material como completado
import { fmt } from "@aula/shared-i18n";
import { SyllabusList } from "@/components/courses/SyllabusList";
import { PdfReader } from "@/components/courses/PdfReader";
import {
  isLessonLocked,
  lessonHref,
  materialFileUrl,
  MATERIAL_ICON,
  nextPendingIndex,
  type CourseMaterial,
} from "@/types/courses";
// [CourseLesson]: pantalla de lección como openLesson del demo → visor (video/PDF/imagen) + lectura en voz alta del PDF + Anterior · Marcar completa · Siguiente + "Temario del curso" lateral
// [Patrón]: Container + Strategy (visor por tipo) + Optimistic UI | [Principio]: SRP + DRY (SyllabusList, lessonHref) | [Paradigma]: Reactivo + Declarativo

export interface CourseLessonProps {
  courseId: string;
  items: CourseMaterial[];
  index: number; // Posición de la lección abierta
  initialCompleted: string[];
  canTrack: boolean; // Inscrito/comprado → se registra el progreso y aplica el bloqueo secuencial
  color: string;
  lang: string; // Idioma del curso (ISO 639-1) → voz del lector
}

export function CourseLesson({
  courseId,
  items,
  index,
  initialCompleted,
  canTrack,
  color,
  lang,
}: CourseLessonProps) {
  const { t } = usePreferences();
  const m = t.courses.materials;
  const router = useRouter();
  const [done, setDone] = useState<ReadonlySet<string>>(
    () => new Set(initialCompleted),
  ); // `Set` (ES2015): pertenencia O(1)
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const current = items[index];
  const pct = items.length
    ? Math.round(
        (items.filter((x) => done.has(x.id)).length / items.length) * 100,
      )
    : 0;
  const nextPending = nextPendingIndex(items, done);
  const prev = items[index - 1];
  const next = items[index + 1];
  const nextLocked = isLessonLocked(index + 1, nextPending, canTrack);

  // [Marcar completa]: Optimistic UI → marca y confirma con el backend (rollback si falla); `advance` navega a la siguiente | [Patrón]: Optimistic Update
  const markDone = (advance: boolean) => {
    if (!canTrack || done.has(current.id)) return;
    setDone((p) => new Set(p).add(current.id));
    startSaving(async () => {
      const res = await completeMaterialAction(courseId, current.id);
      if (!res.ok) {
        setError(res.message);
        setDone((p) => {
          const n = new Set(p);
          n.delete(current.id);
          return n;
        });
        return;
      }
      setDone(new Set(res.data.completedMaterialIds));
      // `router.push` (Next.js): siguiente lección | `router.refresh`: actualiza progreso del servidor
      if (advance && next) router.push(lessonHref(courseId, next.id));
      else router.refresh();
    });
  };

  // [Enlace de navegación]: deshabilitado = <span aria-disabled> (un <a> sin href no es accesible como botón) | [Principio]: DRY
  const navLink = (
    item: CourseMaterial | undefined,
    label: string,
    primary: boolean,
    disabled = false,
  ) =>
    item && !disabled ? (
      <Link
        href={lessonHref(courseId, item.id)}
        className={`btn btn-sm ${primary ? "btn-primary" : "btn-outline"}`}
      >
        {label}
      </Link>
    ) : (
      <span
        aria-disabled="true"
        title={disabled ? m.lockedHint : undefined}
        className={`btn btn-sm pointer-events-none opacity-40 ${primary ? "btn-primary" : "btn-outline"}`}
      >
        {label}
      </span>
    );

  // [Visor por tipo]: `key` → al cambiar de lección se re-monta | [Patrón]: Strategy | JSX guardado en una constante → se ubica según el tipo (DRY)
  const viewer = (
    <div key={current.id} className="overflow-hidden rounded-xl bg-black">
      {current.kind === "video" && (
        <video
          controls
          preload="metadata"
          className="aspect-video w-full"
          aria-label={current.title}
          onEnded={() => markDone(false)}
          // [Sprint 6.7 · URL firmada caducada]: con S3/R2 el video viene de una URL de corta duración; si falla al adelantar, se vuelve a pedir al BFF (nueva firma) y se retoma en el mismo segundo
          onError={(e) => {
            const video = e.currentTarget;
            const at = video.currentTime;
            if (at === 0) return; // Error al empezar → no es caducidad, se muestra el error del navegador
            video.load(); // `load()` (HTMLMediaElement): vuelve a resolver <source> → el backend firma de nuevo
            video.addEventListener("loadedmetadata", () => (video.currentTime = at), { once: true });
          }}
        >
          <source
            src={materialFileUrl(courseId, current.id)}
            type={current.mimeType}
          />
        </video>
      )}
      {current.kind === "pdf" && (
        // [PDF embebido]: visor nativo del navegador en un <iframe> con título accesible
        <iframe
          src={materialFileUrl(courseId, current.id)}
          title={current.title}
          className="h-[70vh] w-full bg-white"
        />
      )}
      {/* [2026-10-23]: audio con reproductor nativo · documento/enlace → tarjeta con botón para abrir (no se pueden incrustar con seguridad) */}
      {current.kind === "audio" && (
        <div className="grid place-items-center bg-card p-6">
          <audio controls preload="metadata" className="w-full max-w-xl" aria-label={current.title} onEnded={() => markDone(false)} src={materialFileUrl(courseId, current.id)} />
        </div>
      )}
      {(current.kind === "document" || current.kind === "link") && (
        <div className="grid place-items-center gap-3 bg-card p-8 text-center">
          <span aria-hidden className="text-4xl">{MATERIAL_ICON[current.kind]}</span>
          <p className="max-w-md break-all text-sm text-muted-foreground">{current.kind === "link" ? current.url : current.originalName}</p>
          <a href={materialFileUrl(courseId, current.id)} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" onClick={() => markDone(false)}>
            {current.kind === "link" ? "Abrir enlace" : "Abrir / descargar"} ↗
          </a>
        </div>
      )}
      {current.kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element -- archivo privado servido por el BFF con sesión (next/image no aplica)
        <img
          src={materialFileUrl(courseId, current.id)}
          alt={current.title}
          className="mx-auto max-h-[70vh] w-auto object-contain"
        />
      )}
    </div>
  );

  return (
    // [Layout lección]: contenido + temario de 320px a la derecha (apilado en móvil) | Tailwind arbitrary value
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-3">
        {/* [Lectura en voz alta]: arriba (solo PDF) — texto resaltado con el audio + traducción completa y por selección; el PDF original queda debajo */}
        {current.kind === "pdf" && (
          <PdfReader
            key={current.id}
            src={materialFileUrl(courseId, current.id)}
            lang={lang}
            color={color}
          />
        )}
        {/* [Video / imagen]: el visor sigue arriba */}
        {current.kind !== "pdf" && viewer}

        {/* [Tarjeta de la lección]: título, posición, progreso y navegación */}
        <div className="surface space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold">
                <span aria-hidden>{MATERIAL_ICON[current.kind]}</span>{" "}
                {current.title}
              </h1>
              <p className="text-xs text-muted-foreground">
                {fmt(m.lesson, { n: index + 1, total: items.length })}
              </p>
            </div>
            {current.kind === "pdf" && (
              <a
                href={materialFileUrl(courseId, current.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
              >
                {m.openPdf} ↗
              </a>
            )}
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
              <span>{m.progressLabel}</span>
              <b className="eeg-mono" style={{ color }}>
                {pct}%
              </b>
            </div>
            {/* `role="progressbar"` + aria-value* (WAI-ARIA): progreso anunciado por lectores de pantalla */}
            <div
              className="h-2 overflow-hidden rounded-full"
              style={{ background: `${color}22` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={m.progressLabel}
            >
              <div
                className="h-full transition-[width] duration-500"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
          </div>
          <nav aria-label={m.lessonNav} className="flex flex-wrap gap-2">
            {navLink(prev, m.prev, false)}
            {canTrack && (
              <button
                type="button"
                onClick={() => markDone(true)}
                disabled={saving || done.has(current.id)}
                className="btn btn-outline btn-sm"
              >
                {done.has(current.id) ? `✓ ${m.done}` : m.markDone}
              </button>
            )}
            {navLink(next, m.next, true, nextLocked)}
          </nav>
          {!canTrack && (
            <p className="text-[11px] text-muted-foreground">
              {m.adminNoProgress}
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs text-tone-danger">
              {error}
            </p>
          )}
        </div>

        {/* [PDF]: el visor original va debajo de la lectura en voz alta y de la tarjeta */}
        {current.kind === "pdf" && viewer}
      </div>

      {/* [Temario del curso lateral]: la lección abierta = "En curso" (aria-current="step") */}
      <nav aria-label={m.syllabus} className="surface h-fit p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{m.syllabus}</h2>
          <span
            className="eeg-mono rounded px-2 py-0.5 text-[11px] font-bold"
            style={{ background: `${color}18`, color }}
          >
            {pct}%
          </span>
        </div>
        <SyllabusList
          courseId={courseId}
          items={items}
          done={done}
          activeIndex={index}
          openIndex={index}
          nextPending={nextPending}
          canTrack={canTrack}
          color={color}
          compact
          labels={{
            done: m.done,
            current: m.current,
            locked: m.lockedStep,
            pending: m.pending,
            lockedHint: m.lockedHint,
            remove: m.remove,
          }}
        />
      </nav>
    </div>
  );
}
