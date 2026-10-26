"use client"; // [Next.js]: Client Component → marcar subtemas como estudiados (Server Action) y desplegarlos
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpenText, CheckCircle2, Circle, Lock } from "lucide-react";
import { Markdown } from "@/components/shared/Markdown";
import { parseSyllabus } from "@/lib/syllabus";
import { completeTopicAction } from "@/lib/purchase-actions";
// [CourseSyllabus · 2026-10-25]: TEMARIO del curso en su página = subtemas desplegables (definición, uso, reglas, ejemplos, videos de YouTube)
// Bloqueado hasta iniciar el curso · cada subtema se marca «Estudiado» → cuenta en el progreso | [Patrón]: Disclosure (<details>) + Optimistic Update | [A11y]: <details>/<summary> nativos

interface Props {
  courseId: string;
  content: string | null;
  completed: string[];
  locked: boolean; // Sin inscripción/compra → solo los títulos
  canTrack: boolean; // Inscrito → puede marcar
  color: string;
}

export function CourseSyllabus({ courseId, content, completed, locked, canTrack, color }: Props) {
  const topics = parseSyllabus(content);
  const [done, setDone] = useState(() => new Set(completed));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!topics.length) return null;

  const toggle = (title: string) => {
    const next = !done.has(title);
    setDone((s) => {
      const n = new Set(s);
      if (next) n.add(title);
      else n.delete(title);
      return n;
    });
    start(async () => {
      const res = await completeTopicAction(courseId, title, next);
      if (!res.ok) {
        setError(res.message);
        setDone(new Set(completed));
        return;
      }
      setError(null);
      router.refresh(); // La barra «Tu progreso» se recalcula en el servidor
    });
  };

  const count = topics.filter((t) => done.has(t.title)).length;
  return (
    <section aria-labelledby="syllabus-title" className="rounded-2xl border border-[var(--nl-brd)] bg-[var(--nl-surf)] p-5 shadow-[var(--nl-shd)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="syllabus-title" className="flex items-center gap-2 text-sm font-semibold text-[var(--nl-txt)]">
          <BookOpenText aria-hidden className="size-4" style={{ color }} /> Temario del curso
        </h2>
        {!locked && <span className="text-xs text-muted-foreground">{count} de {topics.length} subtemas estudiados</span>}
      </div>
      {locked && (
        <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Lock aria-hidden className="size-4" /> Inicia el curso (inscríbete o cómpralo) para estudiar cada subtema.
        </p>
      )}
      <ol className="space-y-2">
        {topics.map((t, i) => {
          const isDone = done.has(t.title);
          return (
            <li key={`${i}-${t.title}`}>
              {locked ? (
                <p className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
                  <Lock aria-hidden className="size-3.5" /> {i + 1}. {t.title}
                </p>
              ) : (
                <details className="group rounded-lg border border-border">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-semibold">
                    {isDone ? <CheckCircle2 aria-hidden className="size-4 text-tone-brand" /> : <Circle aria-hidden className="size-4 text-muted-foreground" />}
                    <span className="flex-1">{i + 1}. {t.title}</span>
                    <span className="text-xs font-normal text-muted-foreground">{isDone ? "Estudiado" : "Pendiente"}</span>
                  </summary>
                  <div className="space-y-3 border-t border-border px-3 py-3">
                    <Markdown text={t.body || "Este subtema aún no tiene explicación."} className="text-sm leading-relaxed" />
                    {canTrack && (
                      <button type="button" className={isDone ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"} disabled={pending} onClick={() => toggle(t.title)}>
                        {isDone ? "Marcar como pendiente" : "✓ Marcar como estudiado"}
                      </button>
                    )}
                  </div>
                </details>
              )}
            </li>
          );
        })}
      </ol>
      {error && <p role="alert" className="mt-2 text-xs text-tone-danger">{error}</p>}
    </section>
  );
}
