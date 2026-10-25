<!--
  [Atomic Design: Atom — capa de fondo de burbujas grandes con paralax.]
  [Patrón: Presentational + Renderless-side-effect (animación encapsulada).]
  [Performance: GPU compositor (transform-gpu); pointer-events:none para no bloquear UI;
   respeta prefers-reduced-motion (a11y).]
-->
<script setup lang="ts">
// [vue: ref/onMounted/onBeforeUnmount.]
import { ref, onMounted, onBeforeUnmount } from 'vue'
// [dep: gsap — animación.]
import gsap from 'gsap'
// [Composable a11y.]
import { useReducedMotion } from '~/composables/useReducedMotion'

// [vue: defineProps — config opcional.]
const props = withDefaults(
  defineProps<{
    count?: number          // [Cantidad de burbujas. Default 8.]
    minSize?: number        // [Tamaño mínimo (px). Default 80.]
    maxSize?: number        // [Tamaño máximo (px). Default 220.]
    parallaxStrength?: number // [Intensidad del paralax con mouse (0-1). Default 0.05.]
  }>(),
  { count: 8, minSize: 80, maxSize: 220, parallaxStrength: 0.05 },
)

// [Helper para generar valores aleatorios.]
function rand(min: number, max: number) {
  return Math.random() * (max - min) + min
}

// [Estilos precomputados UNA vez en el servidor y serializados al cliente via useState.
//  Evita hydration mismatch: Math.random() en render daría valores distintos server/client.]
const bubbleStyles = useState(`bubbles-${props.count}-${props.minSize}-${props.maxSize}`, () =>
  Array.from({ length: props.count }, (_, i) => ({
    position: 'absolute' as const,
    left: `${rand(0, 100)}%`,
    top: `${rand(0, 100)}%`,
    width: `${rand(props.minSize, props.maxSize)}px`,
    height: `${rand(props.minSize, props.maxSize)}px`,
    background: i % 3 === 0
      ? 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.55), rgba(165,98,255,0.18) 60%, rgba(165,98,255,0.05) 100%)'
      : i % 3 === 1
        ? 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.55), rgba(249,112,254,0.20) 60%, rgba(249,112,254,0.05) 100%)'
        : 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.55), rgba(59,130,246,0.18) 60%, rgba(59,130,246,0.05) 100%)',
    borderRadius: '9999px',
    filter: `blur(${rand(2, 6)}px)`,
    opacity: rand(0.45, 0.85),
    mixBlendMode: 'screen' as const,
  })),
)

const containerEl = ref<HTMLElement | null>(null)
const { prefersReducedMotion } = useReducedMotion()

// [Tweens guardados para kill().]
let driftTweens: gsap.core.Tween[] = []
let parallaxHandler: ((e: MouseEvent) => void) | null = null

onMounted(() => {
  if (prefersReducedMotion.value) return
  if (!containerEl.value) return

  const bubbles = containerEl.value.querySelectorAll<HTMLElement>('[data-bubble]')
  if (bubbles.length === 0) return

  // [Drift continuo: cada burbuja sube + se desplaza lateral con duración aleatoria.]
  bubbles.forEach((b, i) => {
    const xDrift = gsap.utils.random(-40, 40)
    const yDrift = gsap.utils.random(-80, -160)
    const dur = gsap.utils.random(8, 16)

    const tw = gsap.to(b, {
      x: `+=${xDrift}`,
      y: `+=${yDrift}`,
      scale: gsap.utils.random(0.9, 1.15),
      duration: dur,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      delay: i * 0.4,
    })
    driftTweens.push(tw)
  })

  // [Paralax: mueve el contenedor según posición del mouse.]
  parallaxHandler = (e: MouseEvent) => {
    if (!containerEl.value) return
    const w = window.innerWidth
    const h = window.innerHeight
    const cx = (e.clientX / w - 0.5) * 2
    const cy = (e.clientY / h - 0.5) * 2
    gsap.to(containerEl.value, {
      x: cx * 30,
      y: cy * 20,
      duration: 0.8,
      ease: 'power2.out',
    })
  }
  window.addEventListener('mousemove', parallaxHandler, { passive: true })
})

onBeforeUnmount(() => {
  driftTweens.forEach((t) => t.kill())
  driftTweens = []
  if (parallaxHandler) window.removeEventListener('mousemove', parallaxHandler)
})
</script>

<template>
  <!--
    [aria-hidden + pointer-events-none — decorativo, no interfiere con UI ni SR.]
    [absolute inset-0 — cubre todo el padre (que debe ser relative).]
    [overflow-hidden — burbujas no escapan del Hero.]
  -->
  <div
    ref="containerEl"
    aria-hidden="true"
    class="absolute inset-0 pointer-events-none overflow-hidden transform-gpu"
  >
    <span
      v-for="(style, i) in bubbleStyles"
      :key="i"
      data-bubble
      :style="style"
      class="transform-gpu"
    />
  </div>
</template>
