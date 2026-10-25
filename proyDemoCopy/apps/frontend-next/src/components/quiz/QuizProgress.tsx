import { cn } from "@/lib/utils";
// [QuizProgress]: barra superior con #/total | [Patron]: Atomic Design (molecule) | [Principio]: SRP

export function QuizProgress({
  current,
  total,
  className,
}: {
  current: number;
  total: number;
  className?: string;
}) {
  const percent = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-1.5 text-xs text-muted-foreground">
        <span>Pregunta {current} de {total}</span>
        <span className="font-semibold text-foreground">{Math.round(percent)}%</span>
      </div>
      <div
        className="h-1.5 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemax={total}
        aria-valuemin={0}
      >
        <div
          className="h-full bg-gradient-brand transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
