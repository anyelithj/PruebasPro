// TopLoader.tsx (Client Component · React + Tailwind) => barra de progreso fina en el borde superior mientras se carga una
// sección (estilo NProgress, sin dependencias). Next App Router no expone eventos de navegación: el clic en un enlace
// interno ARRANCA la barra y el cambio de ruta (usePathname) la COMPLETA. Si el enlace va a otra app (Nuxt), la barra
// avanza hasta que el navegador cambia de página. Espejo: TopLoader.vue en Nuxt (mismo color, alto y tiempos).
// Patrones: Observer (escucha clics del documento y cambios de ruta), State (idle → loading → done).
// Accesibilidad: role="progressbar" con nombre; respeta "prefers-reduced-motion" (sin animación de ancho).
"use client"; // Directiva de Next.js: usa efectos y eventos del navegador

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation"; // Hook de Next: ruta actual (cambia al terminar la navegación)

type Phase = "idle" | "start" | "loading" | "done"; // "start" = ancho 0 un frame, para que la transición arranque desde 0

// isNavigation => ¿este clic va a cambiar de página? (clic izquierdo, sin teclas modificadoras, otra ruta, misma pestaña)
function isNavigation(event: MouseEvent): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const anchor = (event.target as Element | null)?.closest("a");
  if (!anchor?.href || anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
  const url = new URL(anchor.href, window.location.href);
  return url.pathname !== window.location.pathname || url.origin !== window.location.origin;
}

export function TopLoader({ label }: { label: string }) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");

  // Clic en un enlace => empieza la carga (listener en fase de captura: corre antes que el preventDefault de <Link>)
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!isNavigation(event)) return;
      setPhase("start");
      requestAnimationFrame(() => requestAnimationFrame(() => setPhase((current) => (current === "start" ? "loading" : current)))); // 2 frames: el navegador pinta el 0 % antes de animar
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true); // Limpieza: sin listeners duplicados
  }, []);

  // Cambió la ruta => completar la barra y ocultarla un momento después
  useEffect(() => {
    setPhase((current) => (current === "loading" || current === "start" ? "done" : current));
    const timer = window.setTimeout(() => setPhase((current) => (current === "done" ? "idle" : current)), 400);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (phase === "idle") return null;
  return (
    <div role="progressbar" aria-label={label} aria-busy={phase !== "done"} className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5">
      {/* loading: crece lento hasta 85 % (8 s, ease-out); done: completa al 100 % y se desvanece */}
      <div
        className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 shadow-[0_0_8px_theme(colors.indigo.500)] motion-reduce:transition-none"
        style={phase === "start" ? { width: "0%" } : phase === "loading" ? { width: "85%", transition: "width 8s cubic-bezier(.1,.6,.2,1)" } : { width: "100%", opacity: 0, transition: "width .2s ease, opacity .3s ease .15s" }}
      />
    </div>
  );
}
