"use client"; // [Next.js]: Client Component → lista editable de subtemas, IA por subtema e importación
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, ChevronDown, CornerDownRight, Eye, FileUp, ListPlus, PenLine, Plus, Sparkles, Trash2 } from "lucide-react";
import { Markdown } from "@/components/shared/Markdown";
import { TextImport, type ImportedText } from "@/components/shared/TextImport";
import { appendBlock, joinSubtopics, removeBlock, serializeSyllabus, splitSubtopics, toSubtopicBlock, toSubtopicBody, toTopics, type SyllabusPart, type SyllabusTopic } from "@/lib/syllabus";
// [2026-11-03 · Tema → Subtemas]: en pantalla «## » = TEMA (p. ej. «Inglés A2 · Elemental») y «### » = SUBTEMA («Pasado simple: was / were») · el formato guardado NO cambia
// Cada tema se despliega en sus subtemas y CADA subtema tiene «Añadir contenido» (Escribir · Archivo o enlace · IA) con la misma estructura (toSubtopicBody)
// [CourseSyllabusEditor · 2026-10-25]: TEMARIO del curso = subtemas (p. ej. «El verbo to be», «Presente simple»), cada uno con su explicación
// (definición, uso, reglas, ejemplos). Se añaden a mano, con IA (un subtema o todos) o importando PDF, Word, imagen, URL o YouTube → cada importación es un subtema
// Se guarda como Markdown («## Subtema») en el campo oculto `name` | separado de los RECURSOS (archivos y enlaces) | [Patrón]: Controlled list + Command (IA)
// [2026-10-27]: cada subtema admite SUBCONTENIDOS (apartados «### …») que se añaden, ordenan y quitan a mano → temario de dos niveles sin cambiar el formato guardado
// [Patrón]: Composite (subtema → subcontenidos) + Immutable Update | la explicación (`body`) sigue siendo la fuente de verdad: split/join puros (lib/syllabus)
// [2026-10-28]: UX de creación manual → estado vacío, etiquetas visibles y una barra «Añadir contenido» por subtema con TRES vías: escribir, subir archivo/enlace
// (reutiliza TextImport + /api/courses/import) o generar con IA (/api/courses/draft/topic) | [Principio]: DRY (mismos átomos y endpoints que el resto del formulario)

interface Props {
  name: string;
  topics: SyllabusTopic[];
  onChange: (topics: SyllabusTopic[]) => void;
  language: string; // Idioma del curso (IA y OCR)
  getLevel: () => string; // Nivel MCER actual del formulario (se lee al pulsar, no al pintar)
  showImport?: boolean; // [2026-10-27]: `false` cuando el formulario ya ofrece la pestaña «Importar» (evita dos importadores iguales) | `?` (TS): por defecto se muestra
}

// [moved]: copia con el elemento i intercambiado con su vecino (d = -1 ↑ · +1 ↓) | genérico `<T>` (TS) → sirve para subtemas y subcontenidos | [Principio]: DRY
function moved<T>(list: readonly T[], i: number, d: -1 | 1): T[] {
  const next = [...list];
  [next[i], next[i + d]] = [next[i + d]!, next[i]!]; // Desestructuración (ES2015): swap sin variable temporal
  return next;
}

// [focusById · 2026-10-28]: enfoca (y selecciona si es <input>) tras el próximo pintado | `requestAnimationFrame` (Web API): espera a que React monte el control
const focusById = (id: string, select = false) =>
  requestAnimationFrame(() => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    el?.focus();
    if (select) el?.select();
  });

export function CourseSyllabusEditor({ name, topics, onChange, language, getLevel, showImport = true }: Props) {
  const [busy, setBusy] = useState<string | null>(null); // [2026-11-03]: «i» (tema) o «i.j» (subtema) que la IA está explicando
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [importing, setImporting] = useState<string | null>(null); // [2026-11-03]: «i» (tema) o «i.j» (subtema) con el importador abierto
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set()); // [2026-11-03]: temas («i») y subtemas («i.j») plegados
  const toggle = (k: string) => setCollapsed((c) => { const x = new Set(c); if (x.has(k)) x.delete(k); else x.add(k); return x; });
  // [blocksRef · 2026-10-28]: resultado importado → bloque Markdown añadido al subtema | `WeakMap` (ES2015): «Quitar» en TextImport deshace exactamente ese bloque
  const blocksRef = useRef(new WeakMap<ImportedText, string>());

  const set = (i: number, patch: Partial<SyllabusTopic>) => onChange(topics.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  // [2026-10-28]: mover/quitar cierra el importador abierto (su índice dejaría de apuntar al mismo subtema)
  const move = (i: number, d: -1 | 1) => {
    setImporting(null);
    onChange(moved(topics, i, d));
  };
  const remove = (i: number) => {
    setImporting(null);
    setPreview(null);
    onChange(topics.filter((_, j) => j !== i));
  };
  // [setParts]: reescribe la explicación del subtema i a partir de intro + subcontenidos (inmutable) | `Partial` (TS): solo lo que cambia
  const setParts = (i: number, patch: Partial<{ intro: string; subs: SyllabusPart[] }>) => {
    const cur = splitSubtopics(topics[i]!.body);
    set(i, { body: joinSubtopics(patch.intro ?? cur.intro, patch.subs ?? cur.subs) });
  };
  // [setSub]: edita un subcontenido j del subtema i | `map` devuelve copia → nunca se muta el estado
  const setSub = (i: number, j: number, patch: Partial<SyllabusPart>) => setParts(i, { subs: splitSubtopics(topics[i]!.body).subs.map((x, k) => (k === j ? { ...x, ...patch } : x)) });
  // [add · 2026-10-28]: con título → el foco va a su explicación (lo siguiente que se escribe); sin título → al título para nombrarlo
  const add = (title: string, body = "") => {
    const i = topics.length;
    onChange([...topics, { title: title.trim() || `Tema ${i + 1}`, body }]);
    setNewTitle("");
    focusById(title.trim() ? `topic-body-${i}` : `topic-${i}`, !title.trim());
  };
  // [addSub]: nuevo subcontenido vacío y foco en su título
  const addSub = (i: number) => {
    const subs = splitSubtopics(topics[i]!.body).subs;
    setParts(i, { subs: [...subs, { title: `Subtema ${i + 1}.${subs.length + 1}`, body: "" }] });
    focusById(`topic-${i}-sub-${subs.length}`, true);
  };
  // [write]: «Escribir» → sale de la vista previa y enfoca la explicación
  const write = (i: number) => {
    setPreview(null);
    focusById(`topic-body-${i}`);
  };

  // [postTopic · 2026-11-09]: 504 = Ollama ocupado con otra generación o cargando el modelo → un reintento (ya «caliente» suele responder rápido)
  const postTopic = async (body: object): Promise<Response> => {
    const send = () => fetch("/api/courses/draft/topic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const res = await send();
    return res.status === 504 ? send() : res;
  };

  // [explain]: POST /api/courses/draft/topic → definición, uso, reglas, ejemplos y errores comunes del subtema
  const explain = async (i: number) => {
    const t = topics[i]!;
    setBusy(String(i));
    setError(null);
    try {
      const res = await postTopic({ language, level: getLevel(), topic: t.title, ...(t.body.trim() ? { text: t.body } : {}) });
      const data = (await res.json().catch(() => ({}))) as { body?: string; message?: string };
      if (!res.ok || !data.body) throw new Error(data.message ?? `HTTP ${res.status}`);
      setParts(i, { intro: data.body }); // [2026-10-27]: la IA reescribe la explicación general; los subcontenidos escritos a mano se conservan
      setPreview(i);
    } catch (err) {
      setError(`«${t.title}»: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  };

  // [explainSub · 2026-11-03]: IA para UN subtema → misma explicación que el tema (definición, uso, reglas, ejemplos) con encabezados #### (toSubtopicBody)
  const explainSub = async (i: number, j: number) => {
    const t = topics[i]!;
    const sub = splitSubtopics(t.body).subs[j]!;
    setBusy(`${i}.${j}`);
    setError(null);
    try {
      const res = await postTopic({ language, level: getLevel(), topic: `${sub.title} (${t.title})`, ...(sub.body.trim() ? { text: sub.body } : {}) });
      const data = (await res.json().catch(() => ({}))) as { body?: string; message?: string };
      if (!res.ok || !data.body) throw new Error(data.message ?? `HTTP ${res.status}`);
      setSub(i, j, { body: toSubtopicBody(data.body) });
    } catch (err) {
      setError(`«${sub.title}»: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  };
  // [importIntoSub · 2026-11-03]: archivo/enlace → contenido del subtema con la misma estructura que el manual | «Quitar» lo deshace (blocksRef)
  const importIntoSub = (i: number, j: number, x: ImportedText) => {
    const block = toSubtopicBody(x.markdown);
    blocksRef.current.set(x, block);
    const sub = splitSubtopics(topics[i]!.body).subs[j]!;
    setSub(i, j, { body: appendBlock(sub.body, block) });
  };

  // [importInto · 2026-10-30]: archivo/enlace → SIEMPRE dentro de «Explicación del subtema», un solo campo (antes creaba un subcontenido debajo aunque ya hubiera explicación)
  // El título genérico se quita y los encabezados del documento pasan a **negrita** | RegExp con flags `g` + `m`: por línea | los subcontenidos ya escritos a mano se conservan
  const importInto = (i: number, x: ImportedText) => {
    const title = x.title || "Material importado";
    const block = toSubtopicBlock(x.markdown, title)
      .replace(`### ${title.trim()}\n`, "")
      .replace(/^###[ \t]?(.*)$/gm, "**$1**");
    blocksRef.current.set(x, block);
    setParts(i, { intro: appendBlock(splitSubtopics(topics[i]!.body).intro, block) });
  };
  // [unimport]: «Quitar» → retira ese bloque del subtema que lo contenga (si el docente lo editó, ya no coincide y se conserva)
  const unimport = (x: ImportedText) => {
    const block = blocksRef.current.get(x);
    if (!block) return;
    blocksRef.current.delete(x);
    onChange(topics.map((t) => (t.body.includes(block) ? { ...t, body: removeBlock(t.body, block) } : t)));
  };

  const onImported = (x: ImportedText) => onChange([...topics, ...toTopics(x.markdown, x.title || "Material importado")]);

  return (
    <fieldset className="space-y-3 surface-item" aria-describedby={`${name}-hint`}>
      <legend className="px-1 text-sm font-semibold">Temario del curso ({topics.length} {topics.length === 1 ? "tema" : "temas"})</legend>
      <p id={`${name}-hint`} className="type-meta text-muted-foreground">
        El temario empieza por <strong>temas</strong> (p. ej. «Inglés A2 · Elemental») y cada tema se despliega en sus <strong>subtemas</strong> (p. ej. «Pasado simple: was / were»). En el tema y en cada subtema, «Añadir contenido» permite escribirlo, importarlo de un archivo (Word, PDF, imagen) o enlace, o generarlo con IA; los tres quedan con la misma estructura. Los archivos y enlaces de apoyo van en «Recursos del curso».
      </p>
      <input type="hidden" name={name} value={serializeSyllabus(topics)} />

      {/* [Estado vacío · 2026-10-28]: explica qué hacer en vez de una lista en blanco | role="note": información complementaria para el lector de pantalla */}
      {topics.length === 0 && (
        <div role="note" className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
          <BookOpen aria-hidden className="size-6 text-tone-brand" />
          <p className="text-sm font-semibold">Aún no hay temas</p>
          <p className="type-meta max-w-prose text-muted-foreground">Escribe el título del primer tema en «Nuevo tema» (abajo) y pulsa «Añadir tema». Después añade sus subtemas y su contenido: escrito, importado de un archivo o enlace, o generado con IA.</p>
        </div>
      )}

      <ol className="space-y-3">
        {topics.map((t, i) => {
          const parts = splitSubtopics(t.body); // [Derivado]: intro + subcontenidos se calculan del Markdown en cada render (sin estado duplicado) | [Principio]: SSOT
          const label = t.title.trim() || `Tema ${i + 1}`;
          const open = !collapsed.has(String(i));
          return (
          <li key={i} className="space-y-2 rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* [Desplegar · 2026-11-03]: el tema se pliega/despliega con sus subtemas | aria-expanded + aria-controls (WAI-ARIA disclosure) */}
              <button type="button" className="btn btn-ghost btn-sm px-2!" aria-expanded={open} aria-controls={`topic-${i}-panel`} onClick={() => toggle(String(i))} aria-label={`${open ? "Plegar" : "Desplegar"} «${label}»`}>
                <ChevronDown aria-hidden className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} />
              </button>
              <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-tone-brand-soft text-xs font-bold text-tone-brand">{i + 1}</span>
              <label className="sr-only" htmlFor={`topic-${i}`}>Título del tema {i + 1}</label>
              <input id={`topic-${i}`} value={t.title} maxLength={200} placeholder="Título del tema (p. ej. Inglés A2 · Elemental)" onChange={(e) => set(i, { title: e.target.value })} className="control min-w-48 flex-1 font-semibold" />
              <button type="button" className="btn btn-ghost btn-sm" aria-pressed={preview === i} onClick={() => setPreview(preview === i ? null : i)}>
                {preview === i ? <PenLine aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />} {preview === i ? "Editar" : "Vista previa"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm px-2!" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Subir «${label}»`}><ArrowUp aria-hidden className="size-4" /></button>
              <button type="button" className="btn btn-ghost btn-sm px-2!" disabled={i === topics.length - 1} onClick={() => move(i, 1)} aria-label={`Bajar «${label}»`}><ArrowDown aria-hidden className="size-4" /></button>
              <button type="button" className="btn btn-ghost btn-sm px-2! text-tone-danger" onClick={() => remove(i)} aria-label={`Quitar «${label}»`}><Trash2 aria-hidden className="size-4" /></button>
            </div>

            {open && (<div id={`topic-${i}-panel`} className="space-y-2">
            {/* [Añadir contenido · 2026-10-28]: tres vías explícitas por tema | role="group" + aria-label → el lector anuncia «Añadir contenido a …, grupo» */}
            <div role="group" aria-label={`Añadir contenido a «${label}»`} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-2 py-1.5">
              <span aria-hidden className="type-meta font-semibold text-muted-foreground">Añadir contenido:</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => write(i)}>
                <PenLine aria-hidden className="size-4" /> Escribir
              </button>
              {/* `aria-expanded` + `aria-controls`: el botón abre/cierra el panel de importación de ESTE subtema */}
              <button type="button" className="btn btn-ghost btn-sm" aria-expanded={importing === String(i)} aria-controls={`topic-${i}-import`} onClick={() => setImporting(importing === String(i) ? null : String(i))}>
                <FileUp aria-hidden className="size-4" /> Archivo o enlace
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null || !t.title.trim()} aria-busy={busy === String(i)} onClick={() => void explain(i)} title={!t.title.trim() ? "Escribe primero el título del tema" : undefined}>
                <Sparkles aria-hidden className="size-4" /> {busy === String(i) ? "Generando… (hasta 3 min)" : t.body.trim() ? "Mejorar con IA" : "Generar con IA"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => addSub(i)}>
                <Plus aria-hidden className="size-4" /> Añadir subtema
              </button>
            </div>

            {importing === String(i) && (
              <div id={`topic-${i}-import`}>
                <TextImport
                  label={`Importar contenido para «${label}»`}
                  hint="Word, PDF, imagen (OCR), Excel, audio/video o un enlace · se añade a la explicación de este tema (puedes quitarlo después)."
                  onText={(x) => importInto(i, x)}
                  onClear={unimport}
                  language={language}
                  endpoint="/api/courses/import"
                />
              </div>
            )}

            {preview === i ? (
              <Markdown text={t.body || "Sin explicación todavía."} className="rounded-lg bg-muted/40 p-3 text-sm" />
            ) : (
              <>
                <label className="block text-xs font-semibold text-muted-foreground" htmlFor={`topic-body-${i}`}>Explicación del tema</label>
                <textarea id={`topic-body-${i}`} value={parts.intro} rows={parts.intro ? 8 : 3} onChange={(e) => setParts(i, { intro: e.target.value })} placeholder="Definición, uso, reglas y ejemplos (Markdown: **negrita**, - viñetas, enlaces de YouTube en su propia línea)…" className="control w-full font-mono text-xs" />

                {/* [Subcontenidos · 2026-10-27]: apartados del subtema (p. ej. «Afirmativa», «Negativa», «Ejemplos») | <ol> anidada con sangría → jerarquía visible y anunciada por el lector */}
                {parts.subs.length > 0 && (
                  <ol className="ml-2 space-y-2 border-l-2 border-tone-brand-line pl-3" aria-label={`Subtemas de «${label}»`}>
                    {parts.subs.map((sub, j) => {
                      const k = `${i}.${j}`;
                      const subOpen = !collapsed.has(k);
                      const subLabel = sub.title || `subtema ${i + 1}.${j + 1}`;
                      return (
                      <li key={j} className="space-y-1.5 rounded-lg bg-muted/20 p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" className="btn btn-ghost btn-sm px-2!" aria-expanded={subOpen} aria-controls={`topic-${i}-sub-${j}-panel`} onClick={() => toggle(k)} aria-label={`${subOpen ? "Plegar" : "Desplegar"} «${subLabel}»`}>
                            <ChevronDown aria-hidden className={`size-4 transition-transform ${subOpen ? "" : "-rotate-90"}`} />
                          </button>
                          <CornerDownRight aria-hidden className="size-4 shrink-0 text-tone-brand" />
                          <span aria-hidden className="type-meta font-semibold text-muted-foreground">{i + 1}.{j + 1}</span>
                          <label className="sr-only" htmlFor={`topic-${i}-sub-${j}`}>Título del subtema {j + 1} de «{label}»</label>
                          <input id={`topic-${i}-sub-${j}`} value={sub.title} maxLength={200} placeholder={`Subtema ${i + 1}.${j + 1} (p. ej. Pasado simple: was / were)`} onChange={(e) => setSub(i, j, { title: e.target.value })} className="control min-w-40 flex-1 text-sm font-medium" />
                          <button type="button" className="btn btn-ghost btn-sm px-2!" disabled={j === 0} onClick={() => setParts(i, { subs: moved(parts.subs, j, -1) })} aria-label={`Subir «${subLabel}»`}><ArrowUp aria-hidden className="size-4" /></button>
                          <button type="button" className="btn btn-ghost btn-sm px-2!" disabled={j === parts.subs.length - 1} onClick={() => setParts(i, { subs: moved(parts.subs, j, 1) })} aria-label={`Bajar «${subLabel}»`}><ArrowDown aria-hidden className="size-4" /></button>
                          <button type="button" className="btn btn-ghost btn-sm px-2! text-tone-danger" onClick={() => setParts(i, { subs: parts.subs.filter((_, k) => k !== j) })} aria-label={`Quitar «${subLabel}»`}><Trash2 aria-hidden className="size-4" /></button>
                        </div>
                        {subOpen && (
                          <div id={`topic-${i}-sub-${j}-panel`} className="space-y-1.5">
                            {/* [Añadir contenido del subtema · 2026-11-03]: las MISMAS tres vías que el tema → misma estructura (toSubtopicBody) */}
                            <div role="group" aria-label={`Añadir contenido a «${subLabel}»`} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-2 py-1.5">
                              <span aria-hidden className="type-meta font-semibold text-muted-foreground">Añadir contenido:</span>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => focusById(`topic-${i}-sub-${j}-body`)}>
                                <PenLine aria-hidden className="size-4" /> Escribir
                              </button>
                              <button type="button" className="btn btn-ghost btn-sm" aria-expanded={importing === k} aria-controls={`topic-${i}-sub-${j}-import`} onClick={() => setImporting(importing === k ? null : k)}>
                                <FileUp aria-hidden className="size-4" /> Archivo o enlace
                              </button>
                              <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null || !sub.title.trim()} aria-busy={busy === k} onClick={() => void explainSub(i, j)} title={!sub.title.trim() ? "Escribe primero el título del subtema" : undefined}>
                                <Sparkles aria-hidden className="size-4" /> {busy === k ? "Generando… (hasta 3 min)" : sub.body.trim() ? "Mejorar con IA" : "Generar con IA"}
                              </button>
                            </div>
                            {importing === k && (
                              <div id={`topic-${i}-sub-${j}-import`}>
                                <TextImport
                                  label={`Importar contenido para «${subLabel}»`}
                                  hint="Word, PDF, imagen (OCR), Excel, audio/video o un enlace · se añade al contenido de este subtema con la misma estructura (puedes quitarlo después)."
                                  onText={(x) => importIntoSub(i, j, x)}
                                  onClear={unimport}
                                  language={language}
                                  endpoint="/api/courses/import"
                                />
                              </div>
                            )}
                            <label className="sr-only" htmlFor={`topic-${i}-sub-${j}-body`}>Contenido de «{subLabel}»</label>
                            <textarea id={`topic-${i}-sub-${j}-body`} value={sub.body} rows={sub.body ? 6 : 2} onChange={(e) => setSub(i, j, { body: e.target.value })} placeholder={`Contenido de «${subLabel}»: definición, uso, reglas y ejemplos (Markdown)…`} className="control w-full font-mono text-xs" />
                          </div>
                        )}
                      </li>
                      );
                    })}
                  </ol>
                )}
              </>
            )}
            </div>)}
          </li>
          );
        })}
      </ol>
      {error && <p role="alert" className="type-meta text-tone-danger">{error}</p>}

      {/* [Nuevo subtema]: etiqueta visible + ayuda enlazada por aria-describedby | Enter también añade */}
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-tone-brand-line p-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${name}-new`} className="mb-1 block text-xs font-semibold text-muted-foreground">Nuevo tema</label>
          <input id={`${name}-new`} value={newTitle} maxLength={200} aria-describedby={`${name}-new-hint`} placeholder="Ej.: Inglés A2 · Elemental" onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(newTitle); } }} className="control w-full" />
          <p id={`${name}-new-hint`} className="mt-1 type-meta text-muted-foreground">Escribe el título y pulsa Enter o «Añadir tema»; luego añade sus subtemas y su contenido.</p>
        </div>
        <button type="button" className="btn btn-outline sm:mb-6" onClick={() => add(newTitle)}>
          <ListPlus aria-hidden className="size-4" /> Añadir tema
        </button>
      </div>
      {/* Importar: cada archivo/enlace entra como subtema(s) → se pueden reunir y comparar varias fuentes */}
      {showImport && <TextImport label="Importar un tema (PDF, Word, imagen, URL o YouTube)" onText={onImported} language={language} endpoint="/api/courses/import" />}
    </fieldset>
  );
}
