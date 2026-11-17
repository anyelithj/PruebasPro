import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
// [loading.tsx · Next.js App Router · 2026-11-16]: mismo indicador de carga que /dashboard/admin en todo el portal (antes esqueleto propio) | [Principio]: DRY + consistencia
export default function PortalLoading() {
  return <LoadingSpinner className="min-h-[60vh]" />;
}
