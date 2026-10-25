import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
// [StatCard]: tarjeta KPI del portal | [Patrón]: Atomic Design (molecule) + Design System (`surface`) | [Principio]: SRP + DRY
// [UX]: icono sobre el degradado de marca = único acento fuerte de la tarjeta → la cifra manda en la jerarquía visual

export function StatCard({
  label,
  value,
  delta,
  deltaDir = "up",
  icon: Icon,
  valueSuffix,
}: {
  label: string;
  value: React.ReactNode;
  delta?: string;
  deltaDir?: "up" | "down";
  icon: LucideIcon;
  valueSuffix?: React.ReactNode;
}) {
  return (
    <div className="surface relative overflow-hidden p-5">
      {/* `aria-hidden` (ARIA): el icono es decorativo, la etiqueta ya describe el dato */}
      <div
        className="absolute right-5 top-5 grid size-10 place-items-center rounded-xl bg-gradient-brand text-white shadow-[0_4px_12px_-2px_rgba(124,58,237,0.4)]"
        aria-hidden="true"
      >
        <Icon className="size-5" strokeWidth={2} />
      </div>
      <div className="mb-1.5 pr-12 text-sm font-medium text-muted-foreground">{label}</div>
      {/* `tabular-nums` (font-variant-numeric): cifras de ancho fijo → no «bailan» al actualizarse */}
      <div className="text-3xl font-extrabold tabular-nums tracking-tight">
        {value}
        {valueSuffix && (
          <span className="text-lg font-extrabold text-muted-foreground">{valueSuffix}</span>
        )}
      </div>
      {delta && (
        <div
          className={cn(
            "mt-1.5 text-xs font-semibold",
            deltaDir === "up" ? "text-tone-brand" : "text-tone-danger",
          )}
        >
          {deltaDir === "up" ? "↑" : "↓"} {delta}
        </div>
      )}
    </div>
  );
}
