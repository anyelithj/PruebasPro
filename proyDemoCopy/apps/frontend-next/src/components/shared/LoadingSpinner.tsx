// [LoadingSpinner · 2026-10-23 · 4.º pase]: indicador de carga ÚNICO de los `loading.tsx` (Next.js App Router · Suspense de la ruta)
// Ocupa TODO el contenedor (`w-full` + `min-h`) y centra el círculo en los dos ejes con `grid place-items-center` (CSS Grid)
// → antes cada loading.tsx tenía su propio div: sin ancho/alto propio el spinner quedaba pegado a una esquina o muy abajo (min-h-screen dentro del <main>)
// [Patrón]: Presentational Component (RSC, sin JS en el cliente) | [Principio]: DRY + SRP | [A11y]: role="status" + aria-live → el lector anuncia «Cargando…»
// [2026-11-16]: texto VISIBLE bajo el círculo y mismo mensaje en toda la app (crear, editar, eliminar, cargar, listar) | espejo exacto: SpinnerComponent de Angular
export const LOADING_LABEL = "Cargando… puede tardar unos minutos";

export function LoadingSpinner({ label = LOADING_LABEL, className = "min-h-[60vh]" }: { label?: string; className?: string }) {
  return (
    <div className={`grid w-full flex-1 place-items-center ${className}`} role="status" aria-live="polite" aria-busy="true">
      {/* `flex-col` (Tailwind): círculo arriba y texto debajo, centrados */}
      <div className="flex flex-col items-center gap-3">
        {/* `animate-spin` (Tailwind): rotación CSS; motion.css la frena con «movimiento reducido» */}
        <span className="size-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" aria-hidden />
        <span className="text-sm font-semibold text-primary">{label}</span> {/* [2026-11-16]: texto azul, mismo color que el spinner */}
      </div>
    </div>
  );
}
