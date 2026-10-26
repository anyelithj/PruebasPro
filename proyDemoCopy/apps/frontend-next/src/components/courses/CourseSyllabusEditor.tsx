"use client"; // [Next.js]: Client Component → lista editable de subtemas, IA por subtema e importación
import { useState } from "react";
import { ArrowDown, ArrowUp, ListPlus, PenLine, Sparkles, Trash2 } from "lucide-react";
import { Markdown } from "@/components/shared/Markdown";
import { TextImport, type ImportedText } from "@/components/shared/TextImport";
import { serializeSyllabus, toTopics, type SyllabusTopic } from "@/lib/syllabus";
// [CourseSyllabusEditor · 2026-10-25]: TEMARIO del curso = subtemas (p. ej. «El verbo to be», «Presente simple»), cada uno con su explicación
// (definición, uso, reglas, ejemplos). Se añaden a mano, con IA (un subtema o todos) o importando PDF, Word, imagen, URL o YouTube → cada importación es un subtema
// Se guarda como Markdown («## Subtema») en el campo oculto `name` | separado de los RECURSOS (archivos y enlaces) | [Patrón]: Controlled list + Command (IA)

interface Props {
  name: string;
  topics: SyllabusTopic[];
  onChange: (topics: SyllabusTopic[]) => void;
  language: string; // Idioma del curso (IA y OCR)
  getLevel: () => string; // Nivel MCER actual del formulario (se lee al pulsar, no al pintar)
}

export function CourseSyllabusEditor({ name, topics, onChange, language, getLevel }: Props) {
  const [busy, setBusy] = useState<number | null>(null); // Subtema que la IA está explicando
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const set = (i: number, patch: Partial<SyllabusTopic>) => onChange(topics.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...topics];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    onChange(next);
  };
  const add = (title: string, body = "") => {
    onChange([...topics, { title: title.trim() || `Subtema ${topics.length + 1}`, body }]);
    setNewTitle("");
  };

  // [explain]: POST /api/courses/draft/topic → definición, uso, reglas, ejemplos y errores comunes del subtema
  const explain = async (i: number) => {
    const t = topics[i]!;
    setBusy(i);
    setError(null);
    try {
      const res = await fetch("/api/courses/draft/topic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language, level: getLevel(), topic: t.title, ...(t.body.trim() ? { text: t.body } : {}) }) });
      const data = (await res.json().catch(() => ({}))) as { body?: string; message?: string };
      if (!res.ok || !data.body) throw new Error(data.message ?? `HTTP ${res.status}`);
      set(i, { body: data.body });
      setPreview(i);
    } catch (err) {
      setError(`«${t.title}»: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  };

  const onImported = (x: ImportedText) => onChange([...topics, ...toTopics(x.markdown, x.title || "Material importado")]);

  return (
    <fieldset className="space-y-3 rounded-xl border border-border p-4" aria-describedby={`${name}-hint`}>
      <legend className="px-1 text-sm font-semibold">Temario del curso ({topics.length} subtemas)</legend>
      <p id={`${name}-hint`} className="text-xs text-muted-foreground">
        Cada subtema es un tema del idioma (p. ej. «El verbo to be (am / is / are)»). Escribe su explicación o pulsa «Explicar con IA» para obtener definición, uso, reglas y ejemplos. Los archivos y enlaces de apoyo van en «Recursos del curso».
      </p>
      <input type="hidden" name={name} value={serializeSyllabus(topics)} />

      <ol className="space-y-3">
        {topics.map((t, i) => (
          <li key={i} className="space-y-2 rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-tone-brand-soft text-xs font-bold text-tone-brand">{i + 1}</span>
              <label className="sr-only" htmlFor={`topic-${i}`}>Título del subtema {i + 1}</label>
              <input id={`topic-${i}`} value={t.title} maxLength={200} onChange={(e) => set(i, { title: e.target.value })} className="control min-w-48 flex-1 font-semibold" />
              <button type="button" className="btn btn-outline btn-sm" disabled={busy !== null || !t.title.trim()} aria-busy={busy === i} onClick={() => void explain(i)}>
                <Sparkles aria-hidden className="size-4" /> {busy === i ? "Explicando…" : t.body.trim() ? "Mejorar con IA" : "Explicar con IA"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreview(preview === i ? null : i)}>
                <PenLine aria-hidden className="size-4" /> {preview === i ? "Editar" : "Vista previa"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm px-2!" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Subir «${t.title}»`}><ArrowUp aria-hidden className="size-4" /></button>
              <button type="button" className="btn btn-ghost btn-sm px-2!" disabled={i === topics.length - 1} onClick={() => move(i, 1)} aria-label={`Bajar «${t.title}»`}><ArrowDown aria-hidden className="size-4" /></button>
              <button type="button" className="btn btn-ghost btn-sm px-2! text-tone-danger" onClick={() => onChange(topics.filter((_, j) => j !== i))} aria-label={`Quitar «${t.title}»`}><Trash2 aria-hidden className="size-4" /></button>
            </div>
            {preview === i ? (
              <Markdown text={t.body || "Sin explicación todavía."} className="rounded-lg bg-muted/40 p-3 text-sm" />
            ) : (
              <>
                <label className="sr-only" htmlFor={`topic-body-${i}`}>Explicación de «{t.title}»</label>
                <textarea id={`topic-body-${i}`} value={t.body} rows={t.body ? 8 : 3} onChange={(e) => set(i, { body: e.target.value })} placeholder="Definición, uso, reglas y ejemplos (Markdown: **negrita**, - viñetas, enlaces de YouTube en su propia línea)…" className="control w-full font-mono text-xs" />
              </>
            )}
          </li>
        ))}
      </ol>
      {error && <p role="alert" className="text-xs text-tone-danger">{error}</p>}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <label htmlFor={`${name}-new`} className="mb-1 block text-xs font-semibold text-muted-foreground">Nuevo subtema</label>
          <input id={`${name}-new`} value={newTitle} maxLength={200} placeholder="Ej.: Presente simple: preguntas y negación" onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(newTitle); } }} className="control w-full" />
        </div>
        <button type="button" className="btn btn-outline" onClick={() => add(newTitle)}>
          <ListPlus aria-hidden className="size-4" /> Añadir subtema
        </button>
      </div>
      {/* Importar: cada archivo/enlace entra como subtema(s) → se pueden reunir y comparar varias fuentes */}
      <TextImport label="Importar un subtema (PDF, Word, imagen, URL o YouTube)" onText={onImported} language={language} endpoint="/api/courses/import" />
    </fieldset>
  );
}
