// useLanding.ts (Composable + VueUse + Web Animations API) => animación de entrada del hero y tracking de la landing.
// En lugar de GSAP (~70 KB) se usa la Web Animations API NATIVA (0 KB) y solo cuando el elemento entra en pantalla
// (IntersectionObserver): sin trabajo para lo que nadie ve. Respeta "reducir movimiento" (WCAG 2.3.3).
// Patrones: Observer (visibilidad e interacción) + Facade (la UI llama reveal() y trackCta() sin saber cómo).
import { onBeforeUnmount, type Ref } from "vue";
import { useIntersectionObserver } from "@vueuse/core";
import { track } from "~~/shared/lib/analytics";
import { usePrefersReducedMotion } from "~~/shared/composable/useMediaQuery";

export function useLanding(slug: string, root: Ref<HTMLElement | null>) {
  const reduced = usePrefersReducedMotion();
  const animations: Animation[] = [];

  // reveal => cada hijo con [data-reveal] aparece escalonado (fade + desplazamiento), una sola vez
  const { stop } = useIntersectionObserver(
    root,
    ([entry]) => {
      if (!entry?.isIntersecting || !root.value) return;
      stop(); // Una sola vez: después no se observa más (menos trabajo del navegador)
      if (reduced.value) return;
      root.value.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element, index) => {
        animations.push(element.animate([{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }], { duration: 500, delay: index * 120, easing: "ease-out", fill: "backwards" }));
      });
    },
    { threshold: 0.2 }
  );

  // trackCta => clic en el llamado a la acción (analítica en lote, sin bloquear la navegación)
  const trackCta = (label: string) => track("click", { metadata: { landing: slug, cta: label } });

  // Limpieza: cancela animaciones pendientes y deja de observar (sin fugas de memoria al navegar)
  onBeforeUnmount(() => {
    stop();
    animations.forEach((animation) => animation.cancel());
  });

  return { trackCta };
}
