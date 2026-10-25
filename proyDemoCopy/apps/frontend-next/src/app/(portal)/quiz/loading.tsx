import { LoadingSpinner } from "@/components/shared/LoadingSpinner"; // [2026-10-23 · 4.º pase]: spinner centrado en el contenedor (DRY)
// [loading.tsx · Next.js App Router]: UI de carga de la ruta (Suspense automático) mientras el Server Component resuelve sus datos
export default function Loading() {
  return <LoadingSpinner className="min-h-[60vh]" />;
}
