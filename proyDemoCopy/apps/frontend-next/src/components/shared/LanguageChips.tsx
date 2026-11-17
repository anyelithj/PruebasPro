import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { LANGUAGES } from "@/lib/languages";
// [LanguageChips · 2026-10-27]: pestañas de idioma («✦ Todos» + «EN Inglés», «FR Francés»…) — la MISMA clasificación del catálogo de Cursos, ahora reutilizada en Recursos, Exámenes y Actividades
// [Patrón]: Presentational Component (sin "use client" → sirve en Server y Client Components) + URL State (cada chip es un enlace) | [Principio]: DRY + SSOT (LANGUAGES) | [A11y]: <nav> + aria-current="page" (chip activo = degradado de marca vía @utility chip)

// `ComponentProps<typeof Link>["href"]` (TS): mismo tipo que acepta <Link> (string u objeto { pathname, query })
type Href = ComponentProps<typeof Link>["href"];

export interface LanguageChipsProps {
  active?: string; // Código ISO 639-1 activo ("fr") | `undefined` = «Todos»
  hrefFor: (language?: string) => Href; // Construye la URL conservando el resto de filtros (cada página sabe su ruta)
  names?: Readonly<Record<string, string>>; // `dict.languageNames` (claves en mayúscula: "EN") → nombre traducido; sin él, etiqueta ES del SSOT
  allLabel?: string;
  label?: string; // Nombre accesible del grupo (aria-label)
  className?: string;
  extra?: ReactNode; // [2026-11-11]: chip adicional al final del grupo (p. ej. «Poliglota» en Recursos)
}

export function LanguageChips({ active, hrefFor, names, allLabel = "Todos", label = "Idiomas", className, extra }: LanguageChipsProps) {
  const current = active?.toLowerCase(); // Tolera "FR" (cursos) y "fr" (recursos, exámenes, actividades)
  return (
    <nav aria-label={label} className={`flex flex-wrap gap-1.5 ${className ?? ""}`}>
      <Link href={hrefFor(undefined)} aria-current={!current ? "page" : undefined} className="chip">
        <Sparkles aria-hidden className="inline size-4 align-[-0.125em]" /> {allLabel}
      </Link>
      {LANGUAGES.map((l) => {
        const code = l.value.toUpperCase();
        const isActive = current === l.value;
        return (
          // [Toggle]: pulsar el chip activo vuelve a «Todos» (igual que el catálogo de cursos)
          <Link key={l.value} href={hrefFor(isActive ? undefined : l.value)} aria-current={isActive ? "page" : undefined} className="chip">
            <span aria-hidden className="font-mono">{code}</span> {names?.[code] ?? l.label}
          </Link>
        );
      })}
      {extra}
    </nav>
  );
}
