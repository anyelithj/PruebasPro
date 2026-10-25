// useMediaQuery.ts (VueUse) => breakpoints reactivos con los mismos valores que Tailwind (BREAKPOINTS).
// Patrón Observer: matchMedia avisa al cambiar el tamaño (sin escuchar "resize" en cada píxel: menos CPU).
import { useMediaQuery as useVueUseMediaQuery } from "@vueuse/core";
import { BREAKPOINTS } from "../constants/config";

// useBreakpoint("lg") => ref<boolean> true desde 1024 px
export function useBreakpoint(name: keyof typeof BREAKPOINTS) {
  return useVueUseMediaQuery(`(min-width: ${BREAKPOINTS[name]}px)`);
}

// usePrefersReducedMotion => respeta "reducir movimiento" del sistema (WCAG 2.3.3): se desactivan animaciones
export function usePrefersReducedMotion() {
  return useVueUseMediaQuery("(prefers-reduced-motion: reduce)");
}

export { useVueUseMediaQuery as useMediaQuery };
