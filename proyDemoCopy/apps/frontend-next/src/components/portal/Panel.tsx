import { cn } from "@/lib/utils";
// [Panel]: contenedor de sección del portal sobre la utilidad `surface` (mismo radio, borde y sombra del tema que el resto de tarjetas) | [Patrón]: Atomic Design (molecule) + Design System | [Principio]: DRY + SSOT

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("surface p-5", className)}>{children}</div>;
}

export function PanelHead({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    // `gap-3` + `min-w-0`: el título largo se recorta antes de empujar las acciones fuera del panel (móvil)
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-base font-bold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
