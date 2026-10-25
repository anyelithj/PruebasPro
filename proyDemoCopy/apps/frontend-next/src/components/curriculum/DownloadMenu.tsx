import { Download, FileSpreadsheet, FileText, FileType, Sheet } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
// [DownloadMenu · 2026-10-23]: descarga TODO el contenido filtrado (un tema, un tipo…) en PDF, Word, Excel o CSV — antes solo había una plantilla CSV vacía
// [Patrón]: Presentational Component (enlaces nativos, sin estado → sirve en Server y Client Components) | [Principio]: DRY (Gestión y Recursos) | [Tecnología]: <details> HTML nativo como menú desplegable (sin JS)
// [A11y]: <summary> es un botón accesible por teclado; cada enlace dice el formato · `download`: el navegador guarda el archivo que genera NestJS

const FORMATS = [
  { format: "pdf", label: "PDF", icon: FileText },
  { format: "docx", label: "Word", icon: FileType },
  { format: "xlsx", label: "Excel", icon: FileSpreadsheet },
  { format: "csv", label: "CSV", icon: Sheet },
] as const;

// `filters`: los mismos filtros que la página (topic, language, level, kind, status) | valores vacíos se omiten
export function DownloadMenu({ filters, label = "Descargar" }: { filters: Record<string, string | undefined>; label?: string }) {
  const base = Object.entries(filters).filter((e): e is [string, string] => Boolean(e[1])); // Type guard (TS): solo pares con valor
  const hrefFor = (format: string) => `/api/curriculum/export?${new URLSearchParams([...base, ["format", format]])}`;
  return (
    <details className="relative">
      <summary className="btn btn-outline btn-sm cursor-pointer list-none"><Download aria-hidden className="inline size-4 align-[-0.125em]" /> {label}</summary>
      <ul className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-border bg-card p-1 shadow-lg">
        {FORMATS.map((f) => (
          <li key={f.format}>
            <a href={hrefFor(f.format)} download className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <f.icon aria-hidden className="size-4" /> {f.label}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
