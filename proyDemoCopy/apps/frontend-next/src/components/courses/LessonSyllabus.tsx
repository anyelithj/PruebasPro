"use client"; // [Next.js]: Client Component → subtema seleccionado, marcar «Estudiado» y seguimiento del apartado visible
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpenText, ChevronLeft, ChevronRight, PartyPopper } from "lucide-react";
import { Markdown } from "@/components/shared/Markdown";
import { ProgressBar } from "@/components/courses/ProgressBar";
import { STATUS_PILL, statusPillStyle, timelineDotStyle } from "@/components/courses/SyllabusList";
import { progressDetail, useCourseProgress } from "@/components/courses/CourseProgressProvider";
import { parseSyllabus, splitSubtopics, type SyllabusPart } from "@/lib/syllabus";
import { cn } from "@/lib/utils";
import { PdfReader } from "@/components/courses/PdfReader";
import { indexText, locate, rangeOf } from "@/lib/text-highlight"; // [2026-11-16]: marcadores de lectura sobre el texto del subtema // [2026-11-16]: lectura en voz alta del subtema (mismo reproductor que los PDF de la lección)
// [LessonSyllabus · 2026-10-28]: «Temario del curso» en la página de la lección con el MISMO diseño que «Recursos» (sección con borde superior + <h2> + tarjetas `surface`)
// Debajo del título: barra «Progreso del curso» (real, compartida con los recursos vía CourseProgressProvider) · a la IZQUIERDA la línea de tiempo (subtema → subcontenidos) y a la derecha el contenido del subtema
// Estados de cada nodo: completado (✓ relleno) · actual (anillo) · pendiente (hueco) → la línea se «llena» con el color del curso a medida que se estudia, hasta el 100 %
// [Patrón]: Master-Detail + Container/Presentational + Observer (IntersectionObserver → apartado visible) | [Principio]: SRP + DRY (parseSyllabus/splitSubtopics, ProgressBar) | [Paradigma]: Reactivo + Declarativo
// [A11y]: <nav> + <ol> (el lector anuncia «lista, N elementos») · aria-current="step" en el subtema abierto · el estado va en TEXTO además del color (WCAG 1.4.1) · foco al título al cambiar de subtema

type NodeState = "done" | "current" | "pending"; // Unión de literales (TS)
// [Fix 2026-10-31]: «Completado» (antes «Estudiado») = mismo estado que Recursos | símbolo como en su píldora | [Patrón]: Lookup Table
const STATE_LABEL: Readonly<Record<NodeState, string>> = { done: "✓ Completado", current: "▶ En curso", pending: "Pendiente" };

interface Topic {
  title: string;
  intro: string;
  subs: SyllabusPart[];
}

// [ids de anclas]: estables y válidos para `id` HTML | [Principio]: DRY (timeline y contenido usan el mismo)
const subId = (t: number, k: number) => `syllabus-${t}-sub-${k}`;

export function LessonSyllabus({ content, color, lang }: { content: string | null; color: string; lang: string }) {
  const { doneTopics, progress, canTrack, preview, saving, error, setTopicDone } = useCourseProgress();
  // `useMemo` (React): parsear el Markdown solo si cambia el contenido | splitSubtopics → «### Subcontenido» = nodos hijos
  const topics = useMemo<Topic[]>(() => parseSyllabus(content).map((t) => ({ title: t.title, ...splitSubtopics(t.body) })), [content]);
  const firstPending = topics.findIndex((t) => !doneTopics.has(t.title));
  const [selected, setSelected] = useState(() => Math.max(0, firstPending)); // Abre el primer subtema pendiente (o el primero si ya está todo)
  const [activeSub, setActiveSub] = useState(-1); // Apartado visible del subtema abierto (-1 = introducción)
  const titleRef = useRef<HTMLHeadingElement>(null);
  // [Marcadores de lectura · 2026-11-16]: la frase que suena (fondo) y su palabra (amarillo) se resaltan EN el texto del subtema
  // API nativa CSS Custom Highlight (`CSS.highlights` + `::highlight()` en globals.css): no cambia el DOM → no rompe el Markdown ni el foco
  const textRef = useRef<HTMLDivElement>(null);
  const lastAt = useRef(0); // Las frases van en orden → se busca desde la anterior (frases repetidas)
  const [spoken, setSpoken] = useState<{ sentence: string | null; word: [number, number] | null }>({ sentence: null, word: null });
  const onSpeaking = useCallback((sentence: string | null, word: [number, number] | null) => setSpoken({ sentence, word }), []); // `useCallback`: referencia estable → el lector no re-dispara su effect
  useEffect(() => {
    if (typeof CSS === "undefined" || !("highlights" in CSS) || !textRef.current) return; // Navegador sin la API → sin marcadores (la lectura sigue)
    const clear = () => {
      CSS.highlights.delete("reading-sentence");
      CSS.highlights.delete("reading-word");
    };
    if (!spoken.sentence) {
      lastAt.current = 0;
      return clear();
    }
    const index = indexText(textRef.current);
    const at = locate(index.norm, spoken.sentence, spoken.word, lastAt.current);
    const range = at && rangeOf(index, at.start, at.end);
    if (!at || !range) return clear();
    const isNew = at.start !== lastAt.current;
    lastAt.current = at.start;
    CSS.highlights.set("reading-sentence", new Highlight(range));
    const w = at.word && rangeOf(index, at.word[0], at.word[1]);
    if (w) CSS.highlights.set("reading-word", new Highlight(w));
    else CSS.highlights.delete("reading-word");
    // La frase nueva queda a la vista (sin animación si el sistema pide menos movimiento)
    if (isNew) range.startContainer.parentElement?.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    return undefined;
  }, [spoken]);
  useEffect(() => () => { if (typeof CSS !== "undefined" && "highlights" in CSS) CSS.highlights.clear(); }, []); // Al salir de la página

  const current = topics[selected];

  // [Apartado visible]: `IntersectionObserver` (DOM) marca como «actual» el subcontenido que se está leyendo → el nodo hijo de la línea se ilumina
  useEffect(() => {
    if (!current?.subs.length || typeof IntersectionObserver === "undefined") return;
    const nodes = current.subs.map((_, k) => document.getElementById(subId(selected, k))).filter((n): n is HTMLElement => n !== null);
    const io = new IntersectionObserver(
      (entries) => {
        // El apartado visible más alto gana | `rootMargin`: cuenta como «leído» al pasar el 40 % superior de la pantalla
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActiveSub(Number((top.target as HTMLElement).dataset.k));
      },
      { rootMargin: "0px 0px -60% 0px" },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect(); // Cleanup: sin observadores huérfanos al cambiar de subtema
  }, [current, selected]);

  if (!topics.length || !current) return null;

  // [open]: cambia de subtema y lleva el foco a su título (lectores de pantalla y móvil, donde el contenido queda debajo) | `anchor`: salta a un subcontenido
  const open = (i: number, anchor?: string) => {
    setSelected(i);
    setActiveSub(-1);
    // Doble `requestAnimationFrame`: espera a que React pinte el nuevo subtema antes de enfocar/desplazar
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const target = anchor ? document.getElementById(anchor) : titleRef.current;
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ behavior: "smooth", block: anchor ? "start" : "nearest" });
      }),
    );
  };

  const isDone = (i: number) => doneTopics.has(topics[i]!.title);
  const stateOf = (i: number): NodeState => (isDone(i) ? "done" : i === selected ? "current" : "pending");
  const currentDone = isDone(selected);
  // [Siguiente pendiente]: tras «Estudiado y continuar» se salta a la próxima sin estudiar (circular) | `%` módulo
  const nextPendingAfter = (i: number) => {
    for (let k = 1; k < topics.length; k++) {
      const j = (i + k) % topics.length;
      if (!isDone(j)) return j;
    }
    return -1;
  };
  const studyAndContinue = () => {
    setTopicDone(current.title, true);
    const next = nextPendingAfter(selected);
    if (next !== -1) open(next);
  };
  const allTopicsDone = progress.topics.done === progress.topics.total;

  const dotStyle = (s: NodeState, ring: boolean) => timelineDotStyle(s, ring, color); // [2026-10-31]: SSOT con Recursos

  return (
    // [Mismo diseño que «Recursos»]: sección con borde superior, <h2 class="title-section"> y tarjetas `surface` en rejilla (apilado en móvil)
    <section aria-labelledby="lesson-syllabus-title" className="scroll-mt-4 space-y-3 border-t border-border pt-6">
      <h2 id="lesson-syllabus-title" className="title-section flex items-center gap-2">
        <BookOpenText aria-hidden className="size-5" style={{ color }} /> Temario del curso
      </h2>
      {/* [Progreso del curso]: justo debajo del título, compartido con «Recursos» → se mueven juntos */}
      <ProgressBar pct={progress.pct} label="Progreso del curso" color={color} detail={progressDetail(progress)} />
      {allTopicsDone && (
        <p role="status" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: `${color}14`, color }}>
          <PartyPopper aria-hidden className="size-4" /> ¡Temario completado! {progress.pct < 100 ? "Termina los recursos para llegar al 100 %." : "Has completado todo el curso."}
        </p>
      )}

      {/* [Rejilla]: línea de tiempo 320px a la IZQUIERDA + contenido | `minmax(0,1fr)`: un bloque ancho (tabla, código) no desborda */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <nav aria-label="Línea de tiempo del temario" className="surface h-fit p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="title-card">Subtemas</h3>
            <span className="eeg-mono rounded px-2 py-0.5 text-[11px] font-bold" style={{ background: `${color}18`, color }}>
              {progress.topics.done}/{progress.topics.total}
            </span>
          </div>
          <ol>
            {topics.map((t, i) => {
              const s = stateOf(i);
              const last = i === topics.length - 1;
              return (
                <li key={`${i}-${t.title}`} className={cn("relative pl-9", !last && "pb-4")}>
                  {/* [Conector]: tramo de línea hasta el siguiente nodo, relleno con el color del curso si este subtema está estudiado */}
                  {!last && (
                    <span aria-hidden className="absolute bottom-0 left-[11px] top-7 w-0.5 rounded-full motion-safe:transition-colors" style={{ background: s === "done" ? color : "var(--nl-brd)" }} />
                  )}
                  <span aria-hidden className="absolute left-0 top-1 grid size-6 place-items-center rounded-full border-2 text-[11px] font-bold motion-safe:transition-all" style={dotStyle(s, i === selected)}>
                    {s === "done" ? "✓" : i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => open(i)}
                    aria-current={i === selected ? "step" : undefined}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      i === selected && "bg-muted",
                    )}
                  >
                    {/* `min-w-0 flex-1`: el título largo hace salto de línea y la píldora queda a la DERECHA */}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold" style={i === selected ? { color } : undefined}>
                        {t.title}
                      </span>
                      {t.subs.length > 0 && <span className="text-xs text-muted-foreground">{t.subs.length} apartados</span>}
                    </span>
                    {/* [Estado · Fix 2026-10-31]: misma píldora que «▶ En curso» de Recursos, al lado derecho | el significado va en el texto (WCAG 1.4.1) */}
                    <span className={cn(STATUS_PILL, "mt-0.5")} style={statusPillStyle(color)}>
                      {STATE_LABEL[s]}
                    </span>
                  </button>
                  {/* [Subcontenidos]: nodos hijos («### …») → saltan a su apartado */}
                  {t.subs.length > 0 && (
                    <ol className="mt-1 space-y-0.5" aria-label={`Apartados de ${t.title}`}>
                      {t.subs.map((sub, k) => {
                        const subState: NodeState = s === "done" ? "done" : i === selected && k === activeSub ? "current" : "pending";
                        return (
                          <li key={k} className="relative pl-4">
                            <span aria-hidden className="absolute left-0 top-2 size-2 rounded-full border motion-safe:transition-all" style={dotStyle(subState, false)} />
                            <button
                              type="button"
                              onClick={() => open(i, subId(i, k))}
                              aria-current={subState === "current" ? "location" : undefined}
                              className="block w-full truncate rounded px-1.5 py-0.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              style={subState === "current" ? { color, fontWeight: 600 } : undefined}
                            >
                              {sub.title || `Apartado ${k + 1}`}
                              <span className="sr-only"> · {STATE_LABEL[subState]}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* [Contenido del subtema]: <article> con su título enfocable (tabIndex=-1 → foco programático sin entrar en el orden de tabulación) */}
        <article aria-labelledby="lesson-topic-title" className="surface min-w-0 space-y-4 p-5">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="type-meta flex flex-wrap items-center gap-2 text-muted-foreground">
                Subtema {selected + 1} de {topics.length}
                <span className={STATUS_PILL} style={statusPillStyle(color)}>
                  {STATE_LABEL[stateOf(selected)]}
                </span>
              </p>
              <h3 id="lesson-topic-title" ref={titleRef} tabIndex={-1} className="title-card scroll-mt-4 text-lg focus:outline-none" style={{ color }}>
                {current.title}
              </h3>
            </div>
            {/* [Fix 2026-10-31]: la acción también arriba → el botón del pie quedaba lejos en subtemas largos y el estado parecía no cambiar nunca */}
            {canTrack && (
              <button type="button" className="btn btn-outline btn-sm" disabled={saving} aria-pressed={currentDone} onClick={() => setTopicDone(current.title, !currentDone)}>
                {currentDone ? "Marcar como pendiente" : "✓ Marcar como completado"}
              </button>
            )}
          </header>
          {/* [Lectura en voz alta · 2026-11-16]: texto del subtema (intro + apartados) | cada trozo con la voz de su idioma; traducción bloqueada si ya es bilingüe | `key`: reinicia al cambiar de subtema · `compact`: solo controles (el texto ya está debajo → sin tarjeta duplicada) */}
          {(current.intro.trim() || current.subs.length > 0) && (
            <PdfReader
              key={`syllabus-reader-${selected}`}
              text={[current.intro, ...current.subs.map((x) => `${x.title}\n\n${x.body}`)].join("\n\n")}
              lang={lang}
              color={color}
              compact
              onSpeaking={onSpeaking}
            />
          )}
          {/* [Texto del subtema]: contenedor de los marcadores de lectura (textRef) */}
          <div ref={textRef} className="space-y-4">
          {current.intro.trim() && <Markdown text={current.intro} lang={lang} className="text-sm leading-relaxed" />}
          {!current.intro.trim() && !current.subs.length && <p className="text-muted-foreground">Este subtema aún no tiene explicación.</p>}
          {current.subs.map((sub, k) => (
            // `data-k`: índice leído por el IntersectionObserver | `scroll-mt-4`: el ancla no queda pegada al borde
            <section key={k} id={subId(selected, k)} data-k={k} tabIndex={-1} aria-labelledby={`${subId(selected, k)}-h`} className="scroll-mt-4 space-y-2 border-l-2 pl-3 focus:outline-none" style={{ borderColor: `${color}55` }}>
              <h4 id={`${subId(selected, k)}-h`} className="text-sm font-bold">
                {sub.title || `Apartado ${k + 1}`}
              </h4>
              {sub.body.trim() && <Markdown text={sub.body} lang={lang} className="text-sm leading-relaxed" />}
            </section>
          ))}
          </div>

          {/* [Navegación del temario]: Anterior · Estudiado y continuar · Siguiente | <nav> con nombre accesible */}
          <nav aria-label="Navegación del temario" className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <button type="button" className="btn btn-outline btn-sm" disabled={selected === 0} onClick={() => open(selected - 1)}>
              <ChevronLeft aria-hidden className="size-4" /> Anterior
            </button>
            {canTrack &&
              (currentDone ? (
                <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={() => setTopicDone(current.title, false)}>
                  Marcar como pendiente
                </button>
              ) : (
                <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={studyAndContinue}>
                  ✓ Completado
                </button>
              ))}
            <button type="button" className="btn btn-outline btn-sm ml-auto" disabled={selected === topics.length - 1} onClick={() => open(selected + 1)}>
              Siguiente <ChevronRight aria-hidden className="size-4" />
            </button>
          </nav>
          {preview && <p className="type-meta text-muted-foreground">Vista previa: tu avance se guarda solo en este navegador; el de los estudiantes se registra en su cuenta.</p>}
          {error && (
            <p role="alert" className="type-meta text-tone-danger">
              {error}
            </p>
          )}
        </article>
      </div>
    </section>
  );
}
