import * as React from "react";
import { cn } from "@/lib/utils";
// [EmptyState]: estado vacío reutilizable (listas, búsquedas sin resultados) | [Patrón]: Atomic Design (molecule) | [Principio]: SRP | [Buena práctica]: WCAG (status region)

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  // [icon]: nodo opcional para ilustrar el estado | [Patrón]: Slot
  icon?: React.ReactNode;
  // [action]: CTA opcional (botón, link, etc.) | [Patrón]: Slot
  action?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-2 p-8 text-center rounded-lg border border-dashed",
        className,
      )}
      {...rest}
    >
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
