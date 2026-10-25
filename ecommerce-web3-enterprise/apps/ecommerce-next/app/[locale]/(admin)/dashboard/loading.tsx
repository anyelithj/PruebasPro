// loading.tsx (convención de archivo de Next.js App Router) => estado de carga del CONTENEDOR de contenido del panel.
// Next lo envuelve en <Suspense> y lo muestra al instante al navegar (viene prefetcheado) mientras el servidor
// prepara la sección: el menú lateral queda quieto y el spinner aparece donde se va a cargar el contenido.
// Cada subcarpeta lo re-exporta (una línea) porque un loading.tsx solo cubre la navegación hacia SU segmento.
// Accesibilidad: role="status" + texto sr-only => los lectores de pantalla anuncian "Cargando…" (WCAG 4.1.3).
import { getTranslations } from "next-intl/server";
import { Spinner } from "@/shared/ui/Spinner";
import { Skeleton } from "@/shared/ui/Skeleton";

export default async function AdminLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" className="flex flex-col gap-6">
      <div className="flex items-center gap-3 text-slate-600">
        <Spinner className="size-5" />
        <span className="text-sm">{t("loading")}</span>
      </div>
      {/* Esqueletos con la forma típica de una sección (título + filtros + tabla): sin saltos de layout (CLS) */}
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
