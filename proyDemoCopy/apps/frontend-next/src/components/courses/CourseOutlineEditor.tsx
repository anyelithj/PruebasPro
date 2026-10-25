"use client"; // [Next.js]: Client Component → edición del árbol con estado local
import { Sparkles } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fillGapAction, saveOutlineAction } from "@/app/(portal)/admin/courses/[id]/outline/actions";
import { CEFR_LEVELS } from "@/lib/constants";
import { KIND_META, KINDS, SKILL_LABEL, type CourseOutline, type CurriculumSkill, type OutlineLevelInput, type OutlineNode } from "@/types/curriculum";
// [CourseOutlineEditor]: editor de la estructura Nivel → Módulo → Unidad → Lección con huecos y generación con IA | [Patrón]: Composite (árbol) + Command (Server Actions) + Immutable Update (structuredClone) | [Principio]: SRP + DRY (un solo juego de controles para las 4 listas) | [Tecnología]: React 19 + Tailwind CSS
// [Accesibilidad]: cada nivel es un <fieldset> con <legend>; todos los campos y botones tienen nombre accesible; mensajes en `aria-live`

// [toInputs]: árbol guardado → esquema editable (con ids → al guardar se conservan nodos y progreso) | función pura
const toInputs = (levels: OutlineNode[]): OutlineLevelInput[] =>
  levels.map((lv) => ({
    id: lv.id,
    level: lv.level,
    title: lv.title,
    modules: lv.children.map((m) => ({
      id: m.id,
      title: m.title,
      units: m.children.map((u) => ({
        id: u.id,
        title: u.title,
        lessons: u.children.map((ls) => ({ id: ls.id, title: ls.title, topic: ls.topic ?? "", kind: ls.kind ?? "vocabulary", skill: ls.skill ?? "vocabulary" })),
      })),
    })),
  }));

// [lessonInfo]: id de lección → recursos enlazados y si es hueco (del último guardado) | `Map` (ES2015)
const lessonInfo = (levels: OutlineNode[]): Map<string, { items: number; gap: boolean }> => {
  const out = new Map<string, { items: number; gap: boolean }>();
  const walk = (n: OutlineNode) => (n.type === "lesson" ? out.set(n.id, { items: n.items?.length ?? 0, gap: !!n.gap }) : n.children.forEach(walk));
  levels.forEach(walk);
  return out;
};

// [move]: intercambia con el vecino (↑ = -1, ↓ = +1) | muta la copia (nunca el estado)
function move<T>(arr: T[], i: number, d: -1 | 1): void {
  const j = i + d;
  if (j >= 0 && j < arr.length) [arr[i], arr[j]] = [arr[j], arr[i]]; // Desestructuración (ES2015): swap sin variable temporal
}

// [Controles de un elemento de lista]: subir · bajar · quitar | [Principio]: DRY (los usan niveles, módulos, unidades y lecciones)
function ItemControls({ name, onUp, onDown, onRemove }: { name: string; onUp: () => void; onDown: () => void; onRemove: () => void }) {
  const cls = "grid size-7 place-items-center rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <span className="flex shrink-0 gap-0.5">
      <button type="button" onClick={onUp} aria-label={`Subir ${name}`} className={cls}>↑</button>
      <button type="button" onClick={onDown} aria-label={`Bajar ${name}`} className={cls}>↓</button>
      <button type="button" onClick={onRemove} aria-label={`Quitar ${name}`} className={`${cls} hover:text-tone-danger`}>✕</button>
    </span>
  );
}

const INPUT = "control h-9 min-w-0 text-sm";

export function CourseOutlineEditor({ courseId, initial }: { courseId: string; initial: CourseOutline }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial); // Último árbol guardado (huecos y recursos reales)
  const [levels, setLevels] = useState(() => toInputs(initial.levels)); // `useState(() => …)`: inicialización perezosa
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const info = useMemo(() => lessonInfo(saved.levels), [saved]); // `useMemo` (React): solo se recalcula al guardar
  const dirty = JSON.stringify(levels) !== JSON.stringify(toInputs(saved.levels)); // ¿Hay cambios sin guardar?

  // [edit]: actualización inmutable → copia profunda, se aplica el cambio y se reemplaza el estado | `structuredClone` (Web API)
  const edit = (fn: (draft: OutlineLevelInput[]) => void) =>
    setLevels((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      return draft;
    });

  // [Validación en el cliente]: títulos obligatorios y tema de al menos 2 letras (el backend valida igual: Fail Fast en ambos lados)
  const problems = useMemo(() => {
    const out: string[] = [];
    levels.forEach((lv) =>
      lv.modules.forEach((m) => {
        if (!m.title.trim()) out.push(`Un módulo de ${lv.level} no tiene título`);
        m.units.forEach((u) => {
          if (!u.title.trim()) out.push(`Una unidad de «${m.title || "módulo sin título"}» no tiene título`);
          u.lessons.forEach((ls) => {
            if (!ls.title.trim() || ls.topic.trim().length < 2) out.push(`Completa título y tema de las lecciones de «${u.title || "unidad sin título"}»`);
          });
        });
      }),
    );
    return [...new Set(out)]; // Sin mensajes repetidos
  }, [levels]);

  const save = () =>
    startTransition(async () => {
      const res = await saveOutlineAction(courseId, levels);
      if (!res.ok) return setMessage({ ok: false, text: res.message });
      setSaved(res.data);
      setLevels(toInputs(res.data.levels)); // Ids nuevos de lo recién creado
      const { lessons, gaps } = res.data.summary;
      setMessage({ ok: true, text: `Estructura guardada: ${lessons} lecciones, ${gaps} sin contenido (huecos).` });
      router.refresh();
    });

  const generate = (lessonId: string) =>
    startTransition(async () => {
      setGenerating(lessonId);
      const res = await fillGapAction(courseId, lessonId);
      setGenerating(null);
      setMessage(res.ok ? { ok: true, text: res.data.created ? `Se generaron ${res.data.created} recursos (quedan «Generado por IA» hasta revisarlos).` : "La lección ya tenía contenido: se reutilizó." } : { ok: false, text: res.message });
      if (res.ok) router.refresh(); // La página vuelve con el árbol actualizado (el editor se reinicia por `key`)
    });

  const usedLevels = new Set(levels.map((l) => l.level));
  const nextLevel = CEFR_LEVELS.find((l) => !usedLevels.has(l)); // Un nivel MCER por rama

  return (
    <div className="space-y-4">
      {levels.map((lv, li) => (
        <fieldset key={lv.id ?? `new-${li}`} className="surface space-y-3 p-4">
          <legend className="sr-only">Nivel {lv.level}</legend>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Nivel MCER" value={lv.level} onChange={(e) => edit((d) => void (d[li].level = e.target.value as typeof lv.level))} className={`${INPUT} w-24 font-bold`}>
              {CEFR_LEVELS.map((l) => (
                <option key={l} value={l} disabled={l !== lv.level && usedLevels.has(l)}>
                  {l}
                </option>
              ))}
            </select>
            <input aria-label="Título del nivel" placeholder={`Nivel ${lv.level}`} value={lv.title ?? ""} onChange={(e) => edit((d) => void (d[li].title = e.target.value))} className={`${INPUT} flex-1`} />
            <ItemControls name={`nivel ${lv.level}`} onUp={() => edit((d) => move(d, li, -1))} onDown={() => edit((d) => move(d, li, 1))} onRemove={() => edit((d) => void d.splice(li, 1))} />
          </div>

          {lv.modules.map((m, mi) => (
            <div key={m.id ?? `m-${mi}`} className="ml-2 space-y-2 border-l-2 border-tone-brand-line pl-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-tone-brand">Módulo</span>
                <input aria-label="Título del módulo" placeholder="Ej.: Primeros pasos" value={m.title} onChange={(e) => edit((d) => void (d[li].modules[mi].title = e.target.value))} className={`${INPUT} flex-1`} />
                <ItemControls name={`módulo ${m.title}`} onUp={() => edit((d) => move(d[li].modules, mi, -1))} onDown={() => edit((d) => move(d[li].modules, mi, 1))} onRemove={() => edit((d) => void d[li].modules.splice(mi, 1))} />
              </div>

              {m.units.map((u, ui) => (
                <div key={u.id ?? `u-${ui}`} className="ml-2 space-y-2 border-l border-border pl-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">Unidad</span>
                    <input aria-label="Título de la unidad" placeholder="Ej.: Saludos" value={u.title} onChange={(e) => edit((d) => void (d[li].modules[mi].units[ui].title = e.target.value))} className={`${INPUT} flex-1`} />
                    <ItemControls name={`unidad ${u.title}`} onUp={() => edit((d) => move(d[li].modules[mi].units, ui, -1))} onDown={() => edit((d) => move(d[li].modules[mi].units, ui, 1))} onRemove={() => edit((d) => void d[li].modules[mi].units.splice(ui, 1))} />
                  </div>

                  {/* [Lecciones]: rejilla responsive → 1 columna en móvil, 4 campos en escritorio */}
                  <ol className="space-y-2">
                    {u.lessons.map((ls, si) => {
                      const state = ls.id ? info.get(ls.id) : undefined;
                      const set = (patch: Partial<typeof ls>) => edit((d) => Object.assign(d[li].modules[mi].units[ui].lessons[si], patch));
                      return (
                        <li key={ls.id ?? `l-${si}`} className="rounded-lg border border-border bg-background p-2">
                          <div className="grid gap-2 md:grid-cols-[1.4fr_1.2fr_1fr_1fr_auto] md:items-center">
                            <input aria-label="Título de la lección" placeholder="Título de la lección" value={ls.title} onChange={(e) => set({ title: e.target.value })} className={INPUT} />
                            <input aria-label="Tema curricular" placeholder="Tema (p. ej. saludos)" value={ls.topic} onChange={(e) => set({ topic: e.target.value })} className={INPUT} />
                            <select aria-label="Tipo de recurso" value={ls.kind} onChange={(e) => set({ kind: e.target.value as typeof ls.kind })} className={INPUT}>
                              {KINDS.map((k) => (
                                <option key={k} value={k}>
                                  {KIND_META[k].label}
                                </option>
                              ))}
                            </select>
                            <select aria-label="Competencia" value={ls.skill} onChange={(e) => set({ skill: e.target.value as CurriculumSkill })} className={INPUT}>
                              {(Object.keys(SKILL_LABEL) as CurriculumSkill[]).map((s) => (
                                <option key={s} value={s}>
                                  {SKILL_LABEL[s]}
                                </option>
                              ))}
                            </select>
                            <ItemControls name={`lección ${ls.title}`} onUp={() => edit((d) => move(d[li].modules[mi].units[ui].lessons, si, -1))} onDown={() => edit((d) => move(d[li].modules[mi].units[ui].lessons, si, 1))} onRemove={() => edit((d) => void d[li].modules[mi].units[ui].lessons.splice(si, 1))} />
                          </div>
                          {/* [Estado guardado]: recursos reutilizados o hueco con generación (solo lecciones ya guardadas) */}
                          {state && (
                            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                              {state.gap ? (
                                <>
                                  <span className="badge bg-tone-warning-soft text-tone-warning">Hueco: sin recursos</span>
                                  <button type="button" disabled={pending || dirty} onClick={() => generate(ls.id!)} className="btn btn-outline btn-sm" title={dirty ? "Guarda los cambios antes de generar" : undefined}>
                                    {generating === ls.id ? "Generando…" : <><Sparkles aria-hidden className="inline size-4 align-[-0.125em]" /> Generar con IA</>}
                                  </button>
                                </>
                              ) : (
                                <span className="badge bg-tone-brand-soft text-tone-brand">✓ {state.items} recurso(s) enlazado(s)</span>
                              )}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                  <button type="button" onClick={() => edit((d) => void d[li].modules[mi].units[ui].lessons.push({ title: "", topic: "", kind: "vocabulary", skill: "vocabulary" }))} className="btn btn-ghost btn-sm">
                    + Lección
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => edit((d) => void d[li].modules[mi].units.push({ title: "", lessons: [] }))} className="btn btn-ghost btn-sm">
                + Unidad
              </button>
            </div>
          ))}
          <button type="button" onClick={() => edit((d) => void d[li].modules.push({ title: "", units: [] }))} className="btn btn-ghost btn-sm">
            + Módulo
          </button>
        </fieldset>
      ))}

      {/* [Barra de acciones]: fija abajo en pantallas largas para guardar sin volver arriba */}
      <div className="surface sticky bottom-2 z-10 flex flex-wrap items-center gap-2 p-3">
        <button type="button" disabled={!nextLevel} onClick={() => nextLevel && edit((d) => void d.push({ level: nextLevel, modules: [] }))} className="btn btn-outline btn-sm">
          + Nivel {nextLevel ?? ""}
        </button>
        <span className="ml-auto text-xs text-muted-foreground">{dirty ? "Cambios sin guardar" : "Todo guardado"}</span>
        <button type="button" disabled={pending || !dirty || problems.length > 0} onClick={save} className="btn btn-primary">
          {pending && !generating ? "Guardando…" : "Guardar estructura"}
        </button>
      </div>
      <div aria-live="polite" className="space-y-1 text-sm">
        {problems.slice(0, 3).map((p) => (
          <p key={p} className="text-tone-warning">
            • {p}
          </p>
        ))}
        {message && <p className={message.ok ? "text-tone-brand" : "text-tone-danger"}>{message.text}</p>}
      </div>
    </div>
  );
}
