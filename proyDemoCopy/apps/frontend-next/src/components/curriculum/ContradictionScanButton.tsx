"use client"; // [Next.js]: Client Component → estado de carga y mensaje del resultado
import { Scale } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { useState, useTransition } from "react";
import { scanContradictionsAction } from "@/app/(portal)/admin/curriculum/actions";
import { languageLabel } from "@/lib/languages";
// [ContradictionScanButton · Etapa 4]: compara las fuentes del idioma filtrado y marca CONTRADICCION_DETECTADA | [Patrón]: Command (Server Action) + Presentational | [Principio]: SRP | [Tecnología]: React 19 (useTransition) + Tailwind CSS
// [Accesibilidad]: botón deshabilitado con motivo visible · resultado en región `aria-live` (lectores de pantalla lo anuncian)

export function ContradictionScanButton({ language }: { language?: string }) {
  const [pending, startTransition] = useTransition(); // `useTransition` (React): la UI sigue respondiendo mientras corre la acción
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // [run]: ejecuta la Server Action y guarda el mensaje | `startTransition(async …)` (React 19): acción asíncrona sin bloquear
  const run = () => {
    if (!language) return;
    startTransition(async () => setResult(await scanContradictionsAction(language)));
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button type="button" onClick={run} disabled={!language || pending} className="btn btn-outline btn-sm" title={language ? undefined : "Elige un idioma en los filtros"}>
        {pending ? "Comparando…" : <><Scale aria-hidden className="inline size-4 align-[-0.125em]" /> {`Comparar fuentes${language ? ` · ${languageLabel(language)}` : ""}`}</>}
      </button>
      {!language && <span className="text-xs text-muted-foreground">Elige un idioma en los filtros para comparar sus fuentes.</span>}
      <p aria-live="polite" className={result?.ok === false ? "text-xs text-tone-danger" : "text-xs text-muted-foreground"}>
        {result?.message}
      </p>
    </div>
  );
}
