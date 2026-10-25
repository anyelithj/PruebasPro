// [Topbar de página]: título + subtítulo + acciones propias de cada dashboard | [Patrón]: Presentational | [Principio]: SRP
// [Cambio]: el buscador y la campana viven ahora en la barra global (PortalTopbar) → aquí se quitaron para no duplicarlos | [Principio]: DRY
export function Topbar({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  searchPlaceholder?: string; // Conservado por compatibilidad de firma (ya no se usa)
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}
