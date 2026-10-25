"use client"; // [Next.js]: Client Component → petición al BFF y botones «Usar»
import { Sparkles } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { useState } from "react";
import type { IpaValue } from "@/types/curriculum";
// [ResourceVocabularyField · Sprint 8.4]: en el editor de recursos, al escribir un término consulta traducción e IPA UK/US (NestJS Vocabulary → FastAPI LanguageTools, con caché) y deja USAR cada valor en el formulario, que sigue siendo editable | [Patrón]: Presentational + Command (botón «Consultar») | [Principio]: bajo acoplamiento (solo usa el BFF /api/vocabulary/lookup) + el docente decide (nada se sobrescribe solo) | [Paradigma]: Declarativo + async/await
// [A11y]: resultado en región `aria-live`, IPA con `lang="xx-fonipa"`, botones con el valor en el nombre accesible · [Errores]: mensaje en role="alert" (la IA local puede no responder; el IPA sí)

interface LookupResult {
  ipa: string | null;
  ipa_uk: string | null;
  ipa_us: string | null;
  translation: { translation: string; alternatives: string[]; model: string };
}

export function ResourceVocabularyField({
  term,
  language,
  onTranslation,
  onIpa,
}: {
  term: string;
  language: string;
  onTranslation: (translation: string) => void;
  onIpa: (ipa: IpaValue) => void;
}) {
  const [result, setResult] = useState<LookupResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup() {
    setBusy(true);
    setError(null);
    try {
      // [BFF]: cookie httpOnly → Bearer en el servidor; el navegador nunca ve el token
      const res = await fetch("/api/vocabulary/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language, text: term.trim() }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Error ${res.status}`);
      setResult((body.data ?? body).result as LookupResult); // Sobre { statusCode, data } de NestJS
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // [Variantes]: inglés → UK y US (etiquetas BCP 47 del editor); otros idiomas → la única variante con el código del idioma
  const variants: { variant: string; label: string; value: string | null }[] = result
    ? language === "en"
      ? [
          { variant: "en-GB", label: "IPA británico", value: result.ipa_uk },
          { variant: "en-US", label: "IPA estadounidense", value: result.ipa_us },
        ]
      : [{ variant: language, label: "IPA", value: result.ipa }]
    : [];
  const aiDown = result && (result.translation.model === "unavailable" || !result.translation.translation);

  return (
    <div className="rounded-xl border border-dashed border-primary/40 bg-gradient-soft p-3 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">Traducción e IPA automáticos (puedes editarlos después)</p>
        <button type="button" className="btn btn-outline btn-sm" disabled={!term.trim() || busy} onClick={lookup}>
          {busy ? "Consultando…" : <><Sparkles aria-hidden className="inline size-4 align-[-0.125em]" /> Consultar</>}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-tone-danger">
          {error}
        </p>
      )}
      <div aria-live="polite">
        {result && (
          <ul className="mt-2 space-y-1.5 text-sm">
            <li className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <b>Traducción:</b> {aiDown ? <span className="text-tone-warning">la IA local no respondió</span> : <span lang="es">{result.translation.translation}</span>}
              </span>
              {!aiDown && (
                <button type="button" className="btn btn-ghost btn-sm" aria-label={`Usar traducción: ${result.translation.translation}`} onClick={() => onTranslation(result.translation.translation)}>
                  Usar
                </button>
              )}
            </li>
            {variants.map((v) => (
              <li key={v.variant} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <b>{v.label}:</b>{" "}
                  <span lang={`${language}-fonipa`} className="font-mono">
                    {v.value ? `/${v.value}/` : "—"}
                  </span>
                </span>
                {v.value && (
                  <button type="button" className="btn btn-ghost btn-sm" aria-label={`Usar ${v.label}: ${v.value}`} onClick={() => onIpa({ value: `/${v.value}/`, variant: v.variant, source: "espeak-ng (automático)" })}>
                    Usar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
