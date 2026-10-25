// [Capa: Composables — animación GSAP DRY.]
// [Patrón Vue: Composable. SOLID/SRP: una sola responsabilidad — animar entrada con stagger.]
// [DRY: SocialLinksSection, SkillsSection, ProjectsSection compartían misma lógica; ahora una.]
// [dep: gsap — librería de animación.]

// [vue: onMounted — hook ciclo de vida (cliente). ref — referencia reactiva al DOM.]
import { onMounted, type Ref } from 'vue'
// [dep: gsap.]
import gsap from 'gsap'
// [Composable propio.]
import { useReducedMotion } from './useReducedMotion'

// [typescript: interface — opciones tipadas. SOLID/OCP: extensible.]
export interface GsapStaggerOptions {
  readonly y?: number          // [Desplazamiento vertical inicial (px). Default 20.]
  readonly opacity?: number    // [Opacidad inicial. Default 0.]
  readonly stagger?: number    // [Tiempo entre hijos (s). Default 0.1.]
  readonly duration?: number   // [Duración por hijo (s). Default 0.8.]
  readonly ease?: string       // [Easing. Default 'power3.out'.]
}

// [typescript: function — composable.]
// [Recibe ref a contenedor; anima sus hijos al montar, salvo que el usuario prefiera reduce-motion (a11y).]
export function useGsapStagger(
  containerRef: Ref<HTMLElement | null>, // [vue: Ref<HTMLElement | null> — template ref tipada.]
  options: GsapStaggerOptions = {},     // [typescript: default param — DRY de defaults.]
) {
  // [Inyección a11y — fail-safe: si reduce motion, no animamos.]
  const { prefersReducedMotion } = useReducedMotion()

  // [vue: onMounted — corre solo en cliente (cuando el DOM existe).]
  onMounted(() => {
    // [Guard a11y — primer ciclo: si el usuario reduce movimiento, salimos.]
    if (prefersReducedMotion.value) return
    // [Guard nullable — DOM puede no estar listo.]
    if (!containerRef.value) return

    // [dep: gsap.from — anima desde estado inicial al actual del DOM.]
    gsap.from(containerRef.value.children, {
      // [Spread de opciones con defaults. typescript: nullish coalescing ??.]
      opacity: options.opacity ?? 0,
      y: options.y ?? 20,
      stagger: options.stagger ?? 0.1,
      duration: options.duration ?? 0.8,
      ease: options.ease ?? 'power3.out',
    })
  })
}
