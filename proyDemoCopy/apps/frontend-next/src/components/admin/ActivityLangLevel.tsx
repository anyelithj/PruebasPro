"use client"; // [Next.js]: Client Component → reacciona al cambio de los <select> sin recargar la página
import { useRouter, useSearchParams } from "next/navigation";
import { LANGUAGES, LEVEL_OPTIONS as LEVELS } from "@/lib/languages"; // [DRY]: mismos idiomas y niveles con nombre que «Crear recurso»
// [ActivityLangLevel · 2026-10-24]: paso «¿Para qué idioma y nivel?» de Gestión → Crear actividad
// El valor vive en la URL (?idioma=&nivel=) → el Server Component vuelve a pintar las tarjetas con esos parámetros y los editores Angular los reciben ya elegidos
// [Patrón]: URL State + Controlled Component | [Principio]: SSOT (la URL) + DRY | [A11y]: <label> visible por <select>, sin depender de color

export function ActivityLangLevel({ language, level }: { language: string; level: string }) {
  const router = useRouter();
  const params = useSearchParams();

  // [set]: cambia un parámetro y reemplaza la URL (sin nueva entrada en el historial ni salto de scroll) | `URLSearchParams` (Web API)
  const set = (key: "idioma" | "nivel", value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`?${next}`, { scroll: false });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor="act-language" className="mb-1 block text-xs font-semibold text-muted-foreground">
          Idioma <span className="req" aria-hidden>*</span>
        </label>
        <select id="act-language" required value={language} onChange={(e) => set("idioma", e.target.value)} className="control w-full">
          <option value="">Elige idioma…</option>
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="act-level" className="mb-1 block text-xs font-semibold text-muted-foreground">
          Nivel del estudiante <span className="req" aria-hidden>*</span>
        </label>
        <select id="act-level" required value={level} onChange={(e) => set("nivel", e.target.value)} className="control w-full">
          <option value="">Elige nivel…</option>
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
