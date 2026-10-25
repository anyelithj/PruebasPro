// [LoadingSpinner · 2026-10-23 · 4.º pase]: indicador de carga ÚNICO de los `loading.tsx` (Next.js App Router · Suspense de la ruta)
// Ocupa TODO el contenedor (`w-full` + `min-h`) y centra el círculo en los dos ejes con `grid place-items-center` (CSS Grid)
// → antes cada loading.tsx tenía su propio div: sin ancho/alto propio el spinner quedaba pegado a una esquina o muy abajo (min-h-screen dentro del <main>)
// [Patrón]: Presentational Component (RSC, sin JS en el cliente) | [Principio]: DRY + SRP | [A11y]: role="status" + aria-live → el lector anuncia «Cargando…»
export function LoadingSpinner({ label = "Cargando…", className = "min-h-[60vh]" }: { label?: string; className?: string }) {
  return (
    <div className={`grid w-full flex-1 place-items-center ${className}`} role="status" aria-live="polite" aria-busy="true">
      {/* `animate-spin` (Tailwind): rotación CSS; motion.css la frena con «movimiento reducido» */}
      <span className="size-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}
