// [Loading del portal · 2026-10-23]: Suspense boundary de TODO el portal → al pasar de una sección a otra se ve al instante un indicador de carga
// (antes las páginas sin loading.tsx propio dejaban la pantalla anterior congelada mientras el servidor respondía)
// [Patrón]: Skeleton Screen + Suspense (Next.js App Router) | [Principio]: feedback inmediato (UX) | [A11y]: role="status" + texto para lectores de pantalla
export default function PortalLoading() {
  return (
    <div className="w-full space-y-5 py-4" role="status" aria-live="polite" aria-busy="true">
      {/* [Esqueleto]: misma estructura de toda página (título, subtítulo, tarjeta) → sin saltos de diseño al llegar el contenido */}
      <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
      <div className="surface grid min-h-60 place-items-center p-8">
        <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
          <span aria-hidden className="size-6 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
          Cargando…
        </div>
      </div>
    </div>
  );
}
