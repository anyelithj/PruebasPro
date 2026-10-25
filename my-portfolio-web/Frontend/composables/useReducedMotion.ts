// [Capa: Composables — A11y. Detecta `prefers-reduced-motion`.]
// [Patrón Vue: Composable. Wrapper sobre @vueuse/core.]
// [dep: @vueuse/core — usePreferredReducedMotion (reactivo, SSR-safe).]

// [typescript: import — composable de VueUse.]
import { usePreferredReducedMotion } from '@vueuse/core'
// [vue: computed — reactividad derivada.]
import { computed, type ComputedRef } from 'vue'

// [Composable canónico para la app: una única fuente de verdad de "reduce motion".]
// [SOLID/DRY: cualquier consumidor (animaciones GSAP, particles, scroll) usa este, no implementaciones ad-hoc.]
export function useReducedMotion(): { prefersReducedMotion: ComputedRef<boolean> } {
  // [vue: ref reactiva — 'reduce' | 'no-preference' | 'no-preference' depende de media query.]
  const motion = usePreferredReducedMotion()
  // [vue: computed — bool derivado, lazy + cacheado.]
  const prefersReducedMotion = computed(() => motion.value === 'reduce')
  return { prefersReducedMotion }
}
