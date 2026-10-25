import { Globe } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { getDictionary, type Locale } from "@aula/shared-i18n";
// [PolyglotNavLink · Sprint 10.14 · RF-138]: opción «Poliglota» en la sección de Recursos, junto al selector de los siete idiomas → abre la tabla comparativa del remoto Angular (/poliglota) | [Patrón]: Presentational Component (Server Component) | [Principio]: bajo acoplamiento (solo un enlace: el módulo de recursos no cambia) + OCP | [Paradigma]: Declarativo
// `<a>` y no `<Link>`: /poliglota es una ruta del remoto Angular (rewrite) → navegación completa, igual que los ítems `hard` del menú

export function PolyglotNavLink({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).resources;
  return (
    <a href="/poliglota" className="btn btn-outline" aria-describedby="polyglot-hint"> {/* [2026-10-19]: `btn` (40 px) igual que «Filtrar» → misma altura y alineación en la barra */}
      <Globe aria-hidden className="inline size-4 align-[-0.125em]" /> {t.polyglot}
      <span id="polyglot-hint" className="sr-only">
        {t.polyglotHint}
      </span>
    </a>
  );
}
