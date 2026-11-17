import { cn } from "@/lib/utils";
// [ProgressBar · 2026-10-28]: barra de progreso única de los cursos (etiqueta + % + detalle opcional) | [Patrón]: Presentational Component (sin estado, sin "use client" → sirve en Server y Client Components) | [Principio]: DRY + SRP
// [A11y]: `role="progressbar"` + aria-valuenow/min/max (WAI-ARIA) + `aria-valuetext` («3 de 8 completados») → el lector anuncia el avance con contexto, no solo el número
// [Movimiento]: `motion-safe:` (Tailwind) → la animación del ancho respeta «reducir movimiento» del sistema (WCAG 2.3.3)

export interface ProgressBarProps {
  pct: number; // 0..100 (lib/course-progress → pctOf)
  label: string; // Texto visible y nombre accesible
  color: string; // Color del curso
  detail?: string; // `?` (TS): texto secundario, p. ej. «3 de 8 subtemas · 1 de 4 recursos»
  size?: "sm" | "md";
  className?: string;
}

export function ProgressBar({ pct, label, color, detail, size = "md", className }: ProgressBarProps) {
  const value = Math.max(0, Math.min(100, Math.round(pct))); // Acotado → nunca un ancho negativo o >100%
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="font-semibold">{label}</span>
        <b className="eeg-mono" style={{ color }}>
          {value}%
        </b>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={detail ? `${value}% · ${detail}` : `${value}%`}
        className={cn("overflow-hidden rounded-full", size === "sm" ? "h-1.5" : "h-2.5")}
        style={{ background: `${color}22` }} // Pista: color del curso al 13 % (hex con alfa)
      >
        <div className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700" style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}bb, ${color})` }} />
      </div>
      {detail && <p className="type-meta text-muted-foreground">{detail}</p>}
    </div>
  );
}
