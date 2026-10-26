"use client"; // [Next.js]: Client Component → edición en línea, Server Actions y audio de prueba
import { useMemo, useState, useTransition } from "react";
import { BookOpenText, Download, Eye, Languages, RefreshCw, Save, Send, Undo2 } from "lucide-react";
import { enrichReadingAction, replaceReadingTextAction, setReadingStatusAction, updateReadingMetaAction } from "@/app/(portal)/admin/activities/lectura/actions";
import { LEVEL_OPTIONS, languageLabel } from "@/lib/languages";
import { paragraphsFromSentences, READING_GENRE_LABEL, READING_GENRE_OPTIONS, textToParagraphs, type ReadingTextDetail } from "@/lib/reading";
import { SentenceRow } from "./SentenceRow";
// [ReadingEditor · Lectura · 2026-10-25]: editor de Gestión — datos, texto completo (re-divide en frases), frases con traducción/IPA editables, completar IPA/traducción y publicar
// [Patrón]: Container (cliente) + Command (Server Actions) + Composite (SentenceRow por frase) | [Principio]: SRP + DRY (las mismas funciones puras de lib/reading que «Crear actividad»)
// [A11y]: secciones con <h2>, mensajes con role="status"/"alert", botones con texto visible y estado aria-busy · [Responsive]: rejillas que pasan a una columna en móvil

type Msg = { ok: boolean; text: string } | null;

export function ReadingEditor({ text }: { text: ReadingTextDetail }) {
  const verse = text.genre === "poem";
  const [pending, start] = useTransition(); // `useTransition` (React 19): la UI sigue respondiendo mientras corre la acción
  const [msg, setMsg] = useState<Msg>(null);
  const [meta, setMeta] = useState({ title: text.title, level: text.level, genre: text.genre as string, summary: text.summary ?? "", sourceRef: text.sourceRef ?? "" });
  // `useMemo`: el texto completo solo se recalcula si cambian las frases
  const fullText = useMemo(() => paragraphsFromSentences(text.sentences, verse).join("\n\n"), [text.sentences, verse]);
  const [body, setBody] = useState(fullText);
  const published = text.status === "published";
  const enc = encodeURIComponent;

  // [run]: ejecuta una Server Action y muestra su resultado (el RSC se revalida en el servidor → props nuevas)
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, okText: string) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.message ?? "No se pudo completar." });
    });

  const paragraphsByIndex = useMemo(() => {
    const groups = new Map<number, typeof text.sentences>(); // `Map` (ES2015): párrafo → frases en orden
    for (const s of text.sentences) groups.set(s.paragraph, [...(groups.get(s.paragraph) ?? []), s]);
    return [...groups.entries()];
  }, [text.sentences]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            <BookOpenText aria-hidden className="size-7 shrink-0 text-tone-brand" /> <span className="truncate">{text.title}</span>
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="badge bg-tone-brand-soft text-tone-brand">{languageLabel(text.language)}</span>
            <span className="badge bg-muted">{text.level}</span>
            <span className="badge bg-muted">{READING_GENRE_LABEL[text.genre] ?? text.genre}</span>
            <span className={`badge ${published ? "bg-tone-brand-soft text-tone-brand" : "bg-tone-warning-soft text-tone-warning"}`}>{published ? "Publicada" : "Borrador"}</span>
            <span className="text-muted-foreground">
              {text.sentenceCount} frases · {text.wordCount} palabras{text.source === "ai" ? " · generada con IA (revísala)" : ""}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* `<a>`: el lector es una pantalla del remoto Angular (rewrite) → navegación completa */}
          <a href={`/lectura/${enc(text.id)}`} className="btn btn-outline btn-sm">
            <Eye aria-hidden className="size-4" /> Ver como estudiante
          </a>
          <a href={`/api/reading/texts/${enc(text.id)}/export?format=pdf&include=translation,ipa`} className="btn btn-outline btn-sm" download>
            <Download aria-hidden className="size-4" /> PDF
          </a>
          <button type="button" className="btn btn-primary btn-sm" disabled={pending} aria-busy={pending} onClick={() => run(() => setReadingStatusAction(text.id, !published), published ? "Despublicada: vuelve a borrador." : "Publicada: ya la ven los estudiantes.")}>
            {published ? <Undo2 aria-hidden className="size-4" /> : <Send aria-hidden className="size-4" />} {published ? "Despublicar" : "Publicar"}
          </button>
        </div>
      </header>

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-sm ${msg.ok ? "border-tone-info-line bg-tone-info-soft text-tone-info" : "border-tone-danger-line bg-tone-danger-soft text-tone-danger"}`}>
          {msg.text}
        </p>
      )}

      {/* ── Datos ── */}
      <section aria-labelledby="reading-meta" className="surface space-y-3 p-5">
        <h2 id="reading-meta" className="text-lg font-bold">Datos</h2>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updateReadingMetaAction(text.id, meta), "Datos guardados.");
          }}
        >
          <div className="sm:col-span-2">
            <label htmlFor="rd-title" className="mb-1 block text-xs font-semibold text-muted-foreground">Título <span className="req" aria-hidden>*</span></label>
            <input id="rd-title" required minLength={2} maxLength={160} value={meta.title} onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))} className="control w-full" />
          </div>
          <div>
            <label htmlFor="rd-level" className="mb-1 block text-xs font-semibold text-muted-foreground">Nivel</label>
            <select id="rd-level" value={meta.level} onChange={(e) => setMeta((m) => ({ ...m, level: e.target.value }))} className="control w-full">
              {LEVEL_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rd-genre" className="mb-1 block text-xs font-semibold text-muted-foreground">Género</label>
            <select id="rd-genre" value={meta.genre} onChange={(e) => setMeta((m) => ({ ...m, genre: e.target.value }))} className="control w-full">
              {READING_GENRE_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="rd-summary" className="mb-1 block text-xs font-semibold text-muted-foreground">Resumen en español</label>
            <textarea id="rd-summary" rows={2} maxLength={600} value={meta.summary} onChange={(e) => setMeta((m) => ({ ...m, summary: e.target.value }))} className="control w-full" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="rd-source" className="mb-1 block text-xs font-semibold text-muted-foreground">Autor o fuente</label>
            <input id="rd-source" maxLength={300} value={meta.sourceRef} onChange={(e) => setMeta((m) => ({ ...m, sourceRef: e.target.value }))} className="control w-full" />
          </div>
          <div className="flex justify-end sm:col-span-2">
            <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
              <Save aria-hidden className="size-4" /> Guardar datos
            </button>
          </div>
        </form>
      </section>

      {/* ── Texto completo (re-divide en frases) ── */}
      <details className="surface p-5">
        <summary className="cursor-pointer text-lg font-bold">Editar el texto completo</summary>
        <p className="mt-2 text-xs text-muted-foreground">Separa los párrafos con una línea en blanco{verse ? " (en un poema, un verso por línea)" : ""}. Al guardar se vuelve a dividir en frases; las que no cambian conservan su traducción e IPA.</p>
        <label htmlFor="rd-body" className="sr-only">Texto completo</label>
        <textarea id="rd-body" rows={12} value={body} onChange={(e) => setBody(e.target.value)} lang={text.language} className="control mt-3 w-full font-serif leading-relaxed" />
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-ghost" disabled={pending || body === fullText} onClick={() => setBody(fullText)}>
            Deshacer cambios
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending || body === fullText || !body.trim()}
            aria-busy={pending}
            onClick={() =>
              start(async () => {
                const res = await replaceReadingTextAction(text.id, textToParagraphs(body, verse));
                setMsg(res.ok ? { ok: true, text: res.pending ? `Texto guardado. ${res.pending} frase(s) sin IPA o traducción: usa «Completar IPA y traducción».` : "Texto guardado y dividido en frases." } : { ok: false, text: res.message });
              })
            }
          >
            <Save aria-hidden className="size-4" /> Guardar texto
          </button>
        </div>
      </details>

      {/* ── Frases ── */}
      <section aria-labelledby="reading-sentences" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="reading-sentences" className="text-lg font-bold">
            Frases ({text.sentences.length}){text.pending > 0 && <span className="ml-2 badge bg-tone-warning-soft text-tone-warning">{text.pending} sin IPA o traducción</span>}
          </h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline btn-sm" disabled={pending} aria-busy={pending} onClick={() => run(async () => {
              const r = await enrichReadingAction(text.id);
              return r.ok ? { ok: true } : r;
            }, "IPA y traducción completadas donde faltaban.")}>
              <Languages aria-hidden className="size-4" /> Completar IPA y traducción
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={pending} title="Recalcula las frases que no corregiste a mano" onClick={() => run(() => enrichReadingAction(text.id, true), "Recalculadas las frases no revisadas.")}>
              <RefreshCw aria-hidden className="size-4" /> Recalcular
            </button>
          </div>
        </div>
        {paragraphsByIndex.map(([p, sentences]) => (
          <fieldset key={p} className="space-y-2 rounded-xl border border-border p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{verse ? "Estrofa" : "Párrafo"} {p + 1}</legend>
            {sentences.map((s) => (
              // `key` con el texto: si el servidor cambia la frase, la fila se reinicia con los valores nuevos
              <SentenceRow key={`${s.id}:${s.text}:${s.translation}:${s.ipa}`} textId={text.id} language={text.language} sentence={s} onResult={setMsg} />
            ))}
          </fieldset>
        ))}
      </section>
    </div>
  );
}
