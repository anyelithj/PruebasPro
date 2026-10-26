"use client"; // [Next.js]: Client Component → estado local de la fila y audio de prueba
import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Save, Volume2 } from "lucide-react";
import { updateSentenceAction } from "@/app/(portal)/admin/activities/lectura/actions";
import type { ReadingSentence } from "@/lib/reading";
// [SentenceRow · Lectura · 2026-10-25]: una frase editable (texto, traducción, IPA UK/US) con «Escuchar» (GET /api/audio, misma caché que diálogos y vocabulario) y «Guardar» solo si cambió
// [Patrón]: Controlled Component + Command (Server Action) | [Principio]: SRP + la corrección manual prevalece (NestJS marca `reviewed`) | [A11y]: etiquetas visibles por campo, `lang` del idioma en el texto original

interface Props {
  textId: string;
  language: string;
  sentence: ReadingSentence;
  onResult: (msg: { ok: boolean; text: string }) => void;
}

export function SentenceRow({ textId, language, sentence, onResult }: Props) {
  const initial = { text: sentence.text, translation: sentence.translation ?? "", ipa: sentence.ipa, ipaUs: sentence.ipaUs ?? "" };
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const audio = useRef<HTMLAudioElement | null>(null);
  const id = (k: string) => `s-${sentence.id}-${k}`;
  const dirty = (Object.keys(initial) as Array<keyof typeof initial>).filter((k) => v[k] !== initial[k]);
  const missing = !sentence.ipa || (language !== "es" && !sentence.translation);

  // [listen]: WAV del servidor (espeak-ng con caché) | `new Audio` (DOM): un solo audio por fila
  const listen = () => {
    audio.current?.pause();
    const q = new URLSearchParams({ text: v.text.slice(0, 300), language }); // = MaxLength(300) de AudioQueryDto
    audio.current = new Audio(`/api/audio?${q}`);
    void audio.current.play().catch(() => onResult({ ok: false, text: "No se pudo reproducir el audio de la frase." }));
  };

  const save = () =>
    start(async () => {
      // Solo los campos cambiados → NestJS recalcula IPA/traducción si cambió el texto y no se escribieron a mano
      const patch = Object.fromEntries(dirty.map((k) => [k, v[k]]));
      const res = await updateSentenceAction(textId, sentence.id, patch);
      onResult(res.ok ? { ok: true, text: `Frase ${sentence.position + 1} guardada.` } : { ok: false, text: res.message });
    });

  return (
    <div className={`grid gap-2 rounded-lg border p-3 lg:grid-cols-2 ${missing ? "border-tone-warning-line" : "border-border"}`}>
      <div className="lg:col-span-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          Frase {sentence.position + 1}
          {sentence.reviewed && (
            <span className="ml-2 inline-flex items-center gap-1 text-tone-brand">
              <CheckCircle2 aria-hidden className="size-3" /> revisada
            </span>
          )}
          {missing && <span className="ml-2 text-tone-warning">falta IPA o traducción</span>}
        </span>
        <span className="flex gap-1">
          <button type="button" className="btn btn-ghost btn-sm" onClick={listen} aria-label={`Escuchar la frase ${sentence.position + 1}`}>
            <Volume2 aria-hidden className="size-4" />
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={!dirty.length || pending || !v.text.trim()} aria-busy={pending} onClick={save}>
            <Save aria-hidden className="size-4" /> Guardar
          </button>
        </span>
      </div>
      <div>
        <label htmlFor={id("text")} className="mb-1 block text-[11px] font-semibold text-muted-foreground">Original</label>
        <textarea id={id("text")} lang={language} rows={2} maxLength={1000} value={v.text} onChange={(e) => setV({ ...v, text: e.target.value })} className="control w-full" />
      </div>
      <div>
        <label htmlFor={id("tr")} className="mb-1 block text-[11px] font-semibold text-muted-foreground">Traducción (español)</label>
        <textarea id={id("tr")} lang="es" rows={2} maxLength={1500} value={v.translation} onChange={(e) => setV({ ...v, translation: e.target.value })} className="control w-full" />
      </div>
      <div className={language === "en" ? "" : "lg:col-span-2"}>
        <label htmlFor={id("ipa")} className="mb-1 block text-[11px] font-semibold text-muted-foreground">IPA{language === "en" ? " (UK)" : ""}</label>
        <input id={id("ipa")} maxLength={1500} value={v.ipa} onChange={(e) => setV({ ...v, ipa: e.target.value })} className="control w-full font-mono text-sm" />
      </div>
      {language === "en" && (
        <div>
          <label htmlFor={id("ipaus")} className="mb-1 block text-[11px] font-semibold text-muted-foreground">IPA (US)</label>
          <input id={id("ipaus")} maxLength={1500} value={v.ipaUs} onChange={(e) => setV({ ...v, ipaUs: e.target.value })} className="control w-full font-mono text-sm" />
        </div>
      )}
    </div>
  );
}
