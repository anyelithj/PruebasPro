"use client"; // [Next.js]: Client Component → formulario con estado y vista previa de borradores
import { Sparkles } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { useState, useTransition } from "react";
import { certificationPracticeAction, savePracticeAction } from "@/app/(portal)/admin/curriculum/actions";
import { ResourcePreview } from "@/components/curriculum/ResourcePreview"; // [DRY]: la misma ficha de siempre
import { KIND_META, KINDS, SKILL_LABEL, type Certification, type CertificationPractice } from "@/types/curriculum";
// [CertificationPracticePanel · Etapa 5]: genera ítems ORIGINALES de preparación y permite guardar los elegidos como «Generado por IA» | [Patrón]: Command (Server Actions) + Presentational | [Principio]: SRP + DRY | [Tecnología]: React 19 (useTransition) + Tailwind CSS
// [Accesibilidad]: <form> con etiquetas visibles · casillas para elegir borradores · resultado en `aria-live`

export function CertificationPracticePanel({ certifications }: { certifications: Certification[] }) {
  const [certId, setCertId] = useState(certifications[0]?.id ?? "");
  const cert = certifications.find((c) => c.id === certId);
  const [level, setLevel] = useState(cert?.levels[0]?.cefr ?? "B1");
  const [skill, setSkill] = useState<string>(cert?.skills[0] ?? "reading");
  const [kind, setKind] = useState<string>("exercise");
  const [count, setCount] = useState(3);
  const [practice, setPractice] = useState<CertificationPractice | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set()); // Índices de borradores a guardar
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (!cert) return null;

  // [pickCert]: al cambiar de certificación se ajustan nivel y competencia a los que ese examen admite
  const pickCert = (id: string) => {
    const next = certifications.find((c) => c.id === id);
    setCertId(id);
    if (next) {
      setLevel(next.levels[0].cefr);
      setSkill(next.skills[0]);
    }
    setPractice(null);
  };

  const generate = () =>
    startTransition(async () => {
      setMessage(null);
      const res = await certificationPracticeAction({ certificationId: certId, level, skill, kind, count });
      if (!res.ok) return setMessage({ ok: false, text: res.message });
      setPractice(res.data);
      setChosen(new Set(res.data.drafts.map((_, i) => i))); // Todos elegidos por defecto
    });

  const save = () =>
    startTransition(async () => {
      if (!practice) return;
      const drafts = practice.drafts.filter((_, i) => chosen.has(i));
      const res = await savePracticeAction(practice, { language: cert.language, level, skill, kind }, drafts);
      setMessage({ ok: res.ok, text: res.message });
    });

  const field = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
  return (
    <section aria-labelledby="practice-title" className="surface space-y-4 p-5">
      <h2 id="practice-title" className="text-lg font-bold">
        Generar práctica original
      </h2>
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
        onSubmit={(e) => {
          e.preventDefault(); // El envío lo maneja la Server Action
          generate();
        }}
      >
        <div>
          <label htmlFor="p-cert" className={field}>Certificación</label>
          <select id="p-cert" value={certId} onChange={(e) => pickCert(e.target.value)} className="control w-full">
            {certifications.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="p-level" className={field}>Examen</label>
          <select id="p-level" value={level} onChange={(e) => setLevel(e.target.value as typeof level)} className="control w-full">
            {cert.levels.map((l) => (
              <option key={l.cefr} value={l.cefr}>{l.cefr} · {l.exam}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="p-skill" className={field}>Competencia</label>
          <select id="p-skill" value={skill} onChange={(e) => setSkill(e.target.value)} className="control w-full">
            {cert.skills.map((s) => (
              <option key={s} value={s}>{SKILL_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="p-kind" className={field}>Tipo de ítem</label>
          <select id="p-kind" value={kind} onChange={(e) => setKind(e.target.value)} className="control w-full">
            {KINDS.map((k) => (
              <option key={k} value={k}>{KIND_META[k].label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <div className="w-20">
            <label htmlFor="p-count" className={field}>Cantidad</label>
            <input id="p-count" type="number" min={1} max={10} value={count} onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))} className="control w-full" />
          </div>
          <button type="submit" disabled={pending} className="btn btn-primary self-end">
            {pending && !practice ? "Generando…" : <><Sparkles aria-hidden className="inline size-4 align-[-0.125em]" /> Generar</>}
          </button>
        </div>
      </form>

      {practice && (
        <div className="space-y-3">
          {/* [Aviso obligatorio]: originalidad y que no es un examen oficial (regla de la especificación) */}
          <p role="note" className="rounded-lg border border-tone-warning-line bg-tone-warning-soft px-3 py-2 text-sm text-tone-warning">
            {practice.notice}
          </p>
          <p className="text-xs text-muted-foreground">
            Tema: <b>{practice.topic}</b> · origen: {practice.strategy === "cache" ? "caché (sin volver a llamar a la IA)" : practice.strategy === "existing" ? "recurso existente" : "IA local"}
          </p>
          <ul className="space-y-2">
            {practice.drafts.map((d, i) => (
              <li key={i} className="flex gap-3 rounded-lg border border-border p-3">
                <input
                  type="checkbox"
                  aria-label={`Guardar el borrador ${i + 1}`}
                  checked={chosen.has(i)}
                  onChange={(e) => setChosen((prev) => { const next = new Set(prev); if (e.target.checked) next.add(i); else next.delete(i); return next; })}
                  className="mt-1 size-4 shrink-0 accent-[var(--btn-solid)]"
                />
                <ResourcePreview kind={kind as (typeof KINDS)[number]} content={d.content} language={cert.language} />
              </li>
            ))}
          </ul>
          <button type="button" onClick={save} disabled={pending || chosen.size === 0} className="btn btn-primary">
            Guardar {chosen.size} como recursos (Generado por IA)
          </button>
        </div>
      )}
      <p aria-live="polite" className={message?.ok === false ? "text-sm text-tone-danger" : "text-sm text-tone-brand"}>
        {message?.text}
      </p>
    </section>
  );
}
