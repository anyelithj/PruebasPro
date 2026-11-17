"use client"; // [Next.js]: Client Component → marcar completa (Optimistic UI) y navegación entre lecciones
import Link from "next/link";
import { youtubeEmbed } from "@/lib/youtube";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/components/layout/PreferencesProvider";
import { progressDetail, useCourseProgress } from "@/components/courses/CourseProgressProvider"; // [2026-10-28]: progreso compartido con el temario (SSOT)
import { ProgressBar } from "@/components/courses/ProgressBar";
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
// [CourseLesson]: pantalla de lección como openLesson del demo → línea de tiempo de recursos a la izquierda + visor (video/PDF/imagen) + lectura en voz alta del PDF + Anterior · Marcar completa · Siguiente
// [2026-10-27]: se renderiza DENTRO de la sección «Recursos» de la página, debajo del temario (CourseSyllabus) → encabezados <h3>
// [Patrón]: Container + Strategy (visor por tipo) + Optimistic UI | [Principio]: SRP + DRY (SyllabusList, lessonHref) | [Paradigma]: Reactivo + Declarativo
// [Fix 2026-10-28]: el avance ya no vive aquí (antes un `Set` local + % solo de recursos) → useCourseProgress() lo comparte con el temario: misma barra, mismo %, se mueven juntos

export interface CourseLessonProps {
  courseId: string;
  items: CourseMaterial[];
  index: number; // Posición de la lección abierta
  color: string;
  lang: string; // Idioma del curso (ISO 639-1) → voz del lector
  embeddable?: boolean; // [2026-11-05]: false = el dueño del video de YouTube no permite insertarlo
}

export function CourseLesson({
  courseId,
  items,
  index,
  color,
  lang,
  embeddable = true,
}: CourseLessonProps) {
  const { t } = usePreferences();
  const m = t.courses.materials;
  const router = useRouter();
  // [Progreso compartido]: `done` = recursos vistos · `progress` = % real del curso (recursos + subtemas [+ ruta]) | `error`/`saving` de la Server Action
  const { doneMaterials: done, progress, canTrack, preview, saving, error, completeMaterial } = useCourseProgress();

  const current = items[index];
  const nextPending = nextPendingIndex(items, done);
  const prev = items[index - 1];
  const next = items[index + 1];
  const sequential = canTrack && !preview; // [2026-10-30]: el bloqueo secuencial es para alumnos; en vista previa se navega libremente
  const nextLocked = isLessonLocked(index + 1, nextPending, sequential);

  // [Marcar completa]: Optimistic UI en el Provider (rollback si falla) | `advance` → navega a la siguiente cuando NestJS confirma | [Patrón]: Optimistic Update
  const markDone = (advance: boolean) => {
    if (!canTrack || done.has(current.id)) {
      if (advance && next) router.push(lessonHref(courseId, next.id));
      return;
    }
    // `router.push` (Next.js): siguiente lección | sin avanzar, el Provider hace `router.refresh()`
    completeMaterial(current.id, advance && next ? () => router.push(lessonHref(courseId, next.id)) : undefined);
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
    <div key={`viewer-${current.id}`} className="overflow-hidden rounded-xl bg-black">
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
      {/* [2026-10-25]: un enlace de YouTube se reproduce aquí mismo (iframe sin cookies) */}
      {current.kind === "link" && youtubeEmbed(current.url) && !embeddable && (
        // [2026-11-05]: inserción desactivada por el dueño → miniatura + enlace (YouTube no deja reproducirlo dentro de otra web)
        <a href={current.url!} target="_blank" rel="noopener noreferrer" onClick={() => markDone(false)} className="group relative block aspect-video w-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- miniatura pública de YouTube */}
          <img src={`https://i.ytimg.com/vi/${youtubeEmbed(current.url)!.split("/").pop()}/hqdefault.jpg`} alt="" className="size-full object-cover opacity-70 transition-opacity group-hover:opacity-90" />
          <span className="absolute inset-0 grid place-items-center gap-2 p-4 text-center text-white">
            <span className="btn btn-primary">▶ Ver en YouTube ↗</span>
            <span className="type-meta max-w-md rounded bg-black/60 px-2 py-1">El autor de este video no permite reproducirlo fuera de YouTube.</span>
          </span>
        </a>
      )}
      {current.kind === "link" && youtubeEmbed(current.url) && embeddable && (
        <iframe src={youtubeEmbed(current.url)!} title={current.title} className="aspect-video w-full" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
      )}
      {(current.kind === "document" || (current.kind === "link" && !youtubeEmbed(current.url))) && (
        <div className="grid place-items-center gap-3 bg-card p-8 text-center">
          <span aria-hidden className="text-4xl">{MATERIAL_ICON[current.kind]}</span>
          <p className="max-w-md break-all text-muted-foreground">{current.kind === "link" ? current.url : current.originalName}</p>
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
    // [Layout lección · 2026-10-31]: Recursos de 320px a la izquierda + contenido (título, lectura en voz alta y PDF), igual que «Subtemas» | apilado en móvil | `minmax(0,1fr)`: el visor no desborda
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      {/* [Línea de tiempo de Recursos · 2026-10-31]: a la IZQUIERDA y con el mismo estilo que «Subtemas» | va primero en el DOM: orden de lectura = orden visual | la lección abierta = "En curso" (aria-current="step") */}
      <nav aria-label={m.syllabus} className="surface h-fit p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="title-card">{m.syllabus}</h3>
          <span
            className="eeg-mono rounded px-2 py-0.5 text-[11px] font-bold"
            style={{ background: `${color}18`, color }}
          >
            {/* [A11y]: «3/5» visible + frase completa solo para lectores de pantalla (`aria-label` en un <span> sin rol se ignora) */}
            <span aria-hidden>{progress.materials.done}/{progress.materials.total}</span>
            <span className="sr-only">{progress.materials.done} de {progress.materials.total} recursos completados</span>
          </span>
        </div>
        <SyllabusList
          courseId={courseId}
          items={items}
          done={done}
          activeIndex={index}
          openIndex={index}
          nextPending={nextPending}
          canTrack={sequential}
          color={color}
          timeline
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
      <div className="min-w-0 space-y-3">
        {/* [Tarjeta de la lección]: título, posición, progreso y navegación */}
        <div className="surface space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              {/* [2026-10-27]: <h3> (antes <h1>) → la página es el temario del curso; este recurso vive dentro de la sección «Recursos» (<h2>) | [A11y]: jerarquía de encabezados sin saltos */}
              <h3 className="title-card truncate">
                <span aria-hidden>{MATERIAL_ICON[current.kind]}</span>{" "}
                {current.title}
              </h3>
              <p className="type-meta text-muted-foreground">
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
          {/* [Progreso del curso]: MISMO valor que la barra del temario (useCourseProgress) | ProgressBar → role="progressbar" + aria-valuenow */}
          <ProgressBar pct={progress.pct} label={m.progressLabel} color={color} detail={progressDetail(progress)} size="sm" />
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
          {preview && (
            <p className="type-meta text-muted-foreground">
              Vista previa: tu avance se guarda solo en este navegador; el de los estudiantes se registra en su cuenta.
            </p>
          )}
          {error && (
            <p role="alert" className="type-meta text-tone-danger">
              {error}
            </p>
          )}
        </div>

        {/* [2026-10-30]: la tarjeta con Anterior/Siguiente va ANTES del contenido (antes quedaba lejos, tras todo el texto) | lectura en voz alta y visor debajo */}
        {current.kind === "pdf" && (
          <PdfReader
            key={`reader-${current.id}`} // [2026-10-25]: clave distinta del visor (mismo padre en PDF → «two children with the same key»)
            src={materialFileUrl(courseId, current.id)}
            lang={lang}
            color={color}
          />
        )}
        {viewer}
      </div>

    </div>
  );
}
