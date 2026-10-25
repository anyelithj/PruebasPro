"use client"; // [Next.js]: Client Component → lee la URL del navegador y usa sessionStorage
import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
// [RememberReturn · 2026-10-23 · 4.º pase]: un listado (pestaña + filtros + página) se anota como «lugar de regreso» → el «Volver a …» de sus formularios
// (crear, ver, editar) regresa a ESA pestaña/filtro, igual que Gestión → Actividades con ?volver= | sobrevive a redirecciones (crear → ver detalle → editar)
// [Patrón]: Memento (guarda el estado de navegación) + Registry por clave | [Principio]: DRY (un componente para todos los listados) + SRP
// [Tecnología]: sessionStorage (Web Storage API) → por pestaña del navegador; se borra al cerrarla | [Seguridad]: solo rutas internas (ver `safeReturn`)

const KEY = (memo: string) => `aula:volver:${memo}`; // Prefijo propio → sin colisiones con otras claves

// [safeReturn]: solo rutas relativas del propio sitio (empieza por «/» y no por «//») → sin redirección abierta | Función pura
export const safeReturn = (v: string | null | undefined): string | null => (v && /^\/(?!\/)[^\s]*$/.test(v) ? v : null);

// [readReturn]: lugar anotado para la clave o null | `try/catch`: sessionStorage puede lanzar (modo privado, almacenamiento bloqueado)
export function readReturn(memo: string): string | null {
  try {
    return safeReturn(sessionStorage.getItem(KEY(memo)));
  } catch {
    return null;
  }
}

function Recorder({ memo }: { memo: string | readonly string[] }) {
  const pathname = usePathname(); // [Next.js hooks]: cambian con cada navegación cliente (pestañas, filtros, páginas)
  const search = useSearchParams().toString();
  useEffect(() => {
    const url = search ? `${pathname}?${search}` : pathname;
    try {
      for (const m of typeof memo === "string" ? [memo] : memo) sessionStorage.setItem(KEY(m), url);
    } catch {
      /* Sin almacenamiento → el «Volver» usa su destino por defecto */
    }
  }, [memo, pathname, search]);
  return null; // Sin UI
}

// `Suspense` (React): useSearchParams lo exige para no forzar render solo-cliente en páginas estáticas
export function RememberReturn({ memo }: { memo: string | readonly string[] }) {
  return (
    <Suspense fallback={null}>
      <Recorder memo={memo} />
    </Suspense>
  );
}
