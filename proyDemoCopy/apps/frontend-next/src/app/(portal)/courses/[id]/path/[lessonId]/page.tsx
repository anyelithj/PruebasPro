import { MessageCircle } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { KindIcon } from "@/components/shared/KindIcon"; // [2026-10-23]: iconos SVG uniformes por tipo de recurso
import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: enlace «volver» uniforme (icono + texto)
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLesson } from "@/lib/curriculum-api";
import { ApiError } from "@/lib/errors";
import { ResourcePreview } from "@/components/curriculum/ResourcePreview"; // [DRY]: la misma ficha que /resources
import { KIND_META } from "@/types/curriculum";
import { completeLessonAction } from "../actions";
// [Página de lección]: contenido de una lección de la ruta del curso + navegación de la línea de tiempo | [Patrón]: Page (RSC) + PRG con Server Action | [Principio]: SRP + DRY | [Tecnología]: Next.js 16 App Router + Tailwind CSS

type PageProps = { params: Promise<{ id: string; lessonId: string }> }; // Next.js 15+: params es una Promise

export const metadata: Metadata = { title: "Lección", robots: { index: false } }; // Contenido de usuario autenticado: no se indexa

export default async function LessonPage(props: PageProps) {
  const { id: courseId, lessonId } = await props.params;
  const view = await getLesson(courseId, lessonId).catch((err: unknown) => {
    if (err instanceof ApiError && err.status === 404) notFound(); // `notFound()` (Next.js): página 404
    throw err;
  });
  const { lesson, items, path, position, prevLessonId, nextLessonId } = view;
  const pct = Math.round((position.index / position.total) * 100);
  const lessonHref = (id: string) => `/courses/${courseId}/path/${id}`;
  // `.bind` (JS): fija los argumentos de la Server Action para usarla como `action` del formulario (funciona sin JavaScript)
  const complete = completeLessonAction.bind(null, courseId, lessonId);

  return (
    <div className="w-full space-y-5 py-4">
      {/* [Migas]: volver a la ruta del curso */}
      <nav aria-label="Ruta" className="text-xs text-muted-foreground">
        <BackLink href={`/courses/${courseId}#timeline-title`}>Volver a la ruta del curso</BackLink>
        {path.length > 0 && <span> · {path.join(" › ")}</span>}
      </nav>

      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-tone-brand">
          Lección {position.index} de {position.total}
          {lesson.completed && " · ✓ Completada"}
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{lesson.title}</h1>
        {lesson.topic && <p className="text-sm text-muted-foreground">Tema: {lesson.topic}</p>}
        {/* [Sprint 7.14]: foro de la lección (pantalla Angular) → <a> con navegación completa, como los ítems `hard` del menú */}
        <a href={`/foros/leccion/${lesson.id}`} className="inline-block text-sm font-semibold text-primary hover:underline">
          <MessageCircle aria-hidden className="inline size-4 align-[-0.125em]" /> Foro de esta lección
        </a>
        <div role="progressbar" aria-label="Avance en el curso" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </header>

      {/* [Contenido]: un recurso por tarjeta, con la ficha de cada tipo (vocabulario, regla, ejemplo…) */}
      {items.length ? (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.id} className="surface p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <KindIcon kind={it.kind} /> {KIND_META[it.kind].label}
              </p>
              <ResourcePreview kind={it.kind} content={it.content} language={it.language} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="surface p-5 text-sm text-muted-foreground">Esta lección todavía no tiene contenido publicado.</p>
      )}

      {/* [Navegación de la línea de tiempo]: anterior · completar y continuar · siguiente */}
      <nav aria-label="Navegación entre lecciones" className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        {prevLessonId ? (
          <Link href={lessonHref(prevLessonId)} className="btn btn-ghost btn-sm">
            ← Anterior
          </Link>
        ) : (
          <span />
        )}
        {lesson.completed ? (
          nextLessonId && (
            <Link href={lessonHref(nextLessonId)} className="btn btn-primary">
              Siguiente lección →
            </Link>
          )
        ) : (
          // `<form action>` (React 19): envía la Server Action; sin JS también funciona (progresivo)
          <form action={complete}>
            <button type="submit" className="btn btn-primary">
              {nextLessonId ? "Completar y continuar →" : "Completar el curso ✓"}
            </button>
          </form>
        )}
      </nav>
    </div>
  );
}
