<!--
  [Atomic Design: Organism — sección Hero.]
  [Patrón Vue: Container — orquesta tema + reduce-motion + animación.]
  [Performance Pattern: Async Component — NuxtParticles cargado solo si hace falta + reduce-motion respetado.]
  [Animaciones portadas desde tipografia2.html (GSAP):
    - Título: caída char-by-char (elastic) + pulso continuo + restart cada 60s + hover/click stretch-shake.
    - Subtítulo: pulso (yoyo).
    - CTA: bounce hover + stretch-shake click.]
-->
<script setup lang="ts">
// [vue: ref/computed/onMounted/onBeforeUnmount/nextTick — Composition API.]
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
// [Composables propios — DRY.]
import { useThemeMode } from '~/composables/useThemeMode'
import { useReducedMotion } from '~/composables/useReducedMotion'
// [dep: gsap — animación.]
import gsap from 'gsap'
// [Atom — botón CTA, abstrae estilos.]
import AppIcon from '~/components/atoms/AppIcon.vue'
// [Atom — botón de descarga del CV.]
import CvDownloadButton from '~/components/atoms/CvDownloadButton.vue'
// [Atom — capa decorativa de burbujas grandes con paralax (mouse).]
import BubblesBackground from '~/components/atoms/BubblesBackground.vue'

// [Composable — modo tema (light/dark).]
const { isDark } = useThemeMode()
// [Composable — preferencia a11y.]
const { prefersReducedMotion } = useReducedMotion()

// [vue: computed — clase de gradiente derivada del tema. Patrón Strategy via condicional simple.]
const gradientClass = computed(() =>
  isDark.value
    ? 'bg-gradient-to-br from-[#7e22ce] to-[#3b82f6]'
    : 'bg-gradient-to-br from-[#FED84B] via-[#A562FF] to-[#F970FE]',
)

// [vue: computed — opciones de partículas reactivas al tema.]
const particlesOptions = computed(() => ({
  fullScreen: { enable: true, zIndex: -1 },
  background: { color: { value: 'transparent' } },
  fpsLimit: 60,
  detectRetina: true,
  particles: {
    number: { value: 60, density: { enable: true, area: 800 } },
    color: { value: isDark.value ? '#7ec8e3' : '#cceaff' },
    links: {
      enable: true,
      color: isDark.value ? '#7ec8e3' : '#cceaff',
      distance: 150,
      opacity: 0.25,
      width: 1,
    },
    move: { enable: true, speed: 0.6, outModes: 'bounce' as const },
    size: { value: { min: 1, max: 3 } },
    opacity: { value: 0.35 },
  },
  interactivity: {
    events: { onHover: { enable: true, mode: 'repulse' } },
    modes: { repulse: { distance: 100, duration: 0.4 } },
  },
}))

// [Refs DOM tipadas.]
const titleEl = ref<HTMLElement | null>(null)
const descEl = ref<HTMLElement | null>(null)
const ctaEl = ref<HTMLElement | null>(null)

// [Estado de animación — Tweens/Timelines guardados para poder kill().]
let titleFallTl: gsap.core.Timeline | null = null
let titlePulseTw: gsap.core.Tween | null = null
let titleHoverTl: gsap.core.Timeline | null = null
let descPulseTw: gsap.core.Tween | null = null
let restartTimeout: ReturnType<typeof setTimeout> | null = null

// [Splitter: recorre nodos hijos del h1 y envuelve cada carácter en <span class="char-wrap">.
//  Preserva los <span> internos (p.ej. el de "Tu Nombre" con color).]
function splitChars(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = []
  // [Convertimos NodeList → Array (snapshot) porque vamos a mutar root.]
  const childNodes = Array.from(root.childNodes)
  for (const node of childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ''
      const frag = document.createDocumentFragment()
      for (const ch of text) {
        const span = document.createElement('span')
        span.className = 'char-wrap'
        span.style.display = 'inline-block'
        // [&nbsp; para preservar espacios visuales.]
        span.textContent = ch === ' ' ? ' ' : ch
        frag.appendChild(span)
        out.push(span)
      }
      root.replaceChild(frag, node)
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      // [Recursión: para que el span interno (color) también tenga sus letras animables.]
      el.style.display = el.style.display || 'inline-block'
      out.push(...splitChars(el))
    }
  }
  return out
}

// [Animación: caída de letras con rebote elástico.]
function playTitleFall(chars: HTMLElement[], h1: HTMLElement) {
  titlePulseTw?.kill()
  titleFallTl?.kill()
  if (restartTimeout) clearTimeout(restartTimeout)

  // [Estado inicial: arriba, invisibles, rotadas, escala 2.]
  gsap.set(chars, {
    y: -120,
    opacity: 0,
    rotation: () => gsap.utils.random(-30, 30),
    scale: 2,
    display: 'inline-block',
  })
  gsap.set(h1, { scale: 1, opacity: 1, filter: 'none' })

  titleFallTl = gsap.timeline({
    onComplete: () => {
      startTitlePulse(h1)
      restartTimeout = setTimeout(() => playTitleFall(chars, h1), 30 * 1000)
    },
  })
  titleFallTl.to(chars, {
    y: 0,
    opacity: 1,
    rotation: 0,
    scale: 1,
    stagger: { each: 0.07, from: 'start', grid: 'auto' },
    ease: 'elastic.out(1.5, 0.4)',
    duration: 1.8,
    delay: 0.2,
  })
}

// [Pulso continuo del título — yoyo infinito.]
function startTitlePulse(h1: HTMLElement) {
  titlePulseTw?.kill()
  titlePulseTw = gsap.to(h1, {
    scale: 1.01,
    opacity: 0.95,
    filter: 'blur(0.5px)',
    duration: 1.2,
    ease: 'power1.inOut',
    yoyo: true,
    repeat: -1,
  })
}

// [Hover/click del título: pausa el pulso, ejecuta stretch+shake, reanuda pulso.]
function applyTitleHoverClick(h1: HTMLElement, chars: HTMLElement[]) {
  if (titlePulseTw?.isActive()) titlePulseTw.pause()
  if (restartTimeout) clearTimeout(restartTimeout)

  gsap.set(h1, { scaleY: 1, x: 0, scale: 1, opacity: 1, filter: 'none' })
  titleHoverTl?.kill()

  titleHoverTl = gsap.timeline({
    onComplete: () => {
      startTitlePulse(h1)
      restartTimeout = setTimeout(() => playTitleFall(chars, h1), 30 * 1000)
    },
  })
  titleHoverTl
    .to(h1, { scaleY: 1.2, duration: 0.3, ease: 'elastic.out(1, 0.3)' })
    .to(h1, { x: '+=10', repeat: 5, yoyo: true, duration: 0.05, ease: 'power1.inOut' }, '<')
    .to(h1, { scaleY: 1, duration: 0.5, ease: 'elastic.out(1, 0.3)' }, '+=0.2')
}

// [Pulso del subtítulo (efecto demoníaco suave).]
function startDescPulse(p: HTMLElement) {
  descPulseTw?.kill()
  descPulseTw = gsap.to(p, {
    scale: 1.02,
    opacity: 0.9,
    filter: 'blur(1px)',
    duration: 1.5,
    ease: 'power1.inOut',
    yoyo: true,
    repeat: -1,
  })
}

// [Hover del CTA: pequeño bounce vertical + squash.]
let ctaHoverTw: gsap.core.Tween | null = null
function ctaHoverIn(btn: HTMLElement) {
  gsap.set(btn, { scaleX: 1, scaleY: 1, y: 0 })
  ctaHoverTw?.kill()
  ctaHoverTw = gsap.to(btn, {
    y: -5,
    scaleX: 1.05,
    scaleY: 0.95,
    duration: 0.2,
    ease: 'power1.out',
    yoyo: true,
    repeat: 1,
    onComplete: () => {
      gsap.to(btn, { y: 0, scaleX: 1, scaleY: 1, duration: 0.3, ease: 'elastic.out(1, 0.3)' })
    },
  })
}
function ctaHoverOut(btn: HTMLElement) {
  ctaHoverTw?.kill()
  gsap.to(btn, { y: 0, scaleX: 1, scaleY: 1, duration: 0.3, ease: 'power1.out' })
}

// [Click CTA: stretch+shake (mismo motivo que el título).]
let ctaClickTl: gsap.core.Timeline | null = null
function ctaClick(btn: HTMLElement) {
  gsap.set(btn, { scaleY: 1, x: 0 })
  ctaClickTl?.kill()
  ctaClickTl = gsap.timeline({ defaults: { ease: 'power1.out' } })
  ctaClickTl
    .to(btn, { scaleY: 1.2, duration: 0.3, ease: 'elastic.out(1, 0.3)' })
    .to(btn, { x: '+=10', repeat: 5, yoyo: true, duration: 0.05, ease: 'power1.inOut' }, '<')
    .to(btn, { scaleY: 1, duration: 0.5, ease: 'elastic.out(1, 0.3)' }, '+=0.2')
}

// [Listeners guardados para remover en unmount.]
let titleEnterHandler: (() => void) | null = null
let titleClickHandler: (() => void) | null = null
let ctaEnterHandler: (() => void) | null = null
let ctaLeaveHandler: (() => void) | null = null
let ctaClickHandler: (() => void) | null = null

onMounted(async () => {
  if (prefersReducedMotion.value) return
  await nextTick()

  const h1 = titleEl.value
  const p = descEl.value
  const cta = ctaEl.value
  if (!h1) return

  // [1. Split del título en chars (preservando span interno).]
  const chars = splitChars(h1)

  // [2. Caída inicial + auto-restart cada 60s.]
  playTitleFall(chars, h1)

  // [3. Subtítulo pulso continuo.]
  if (p) startDescPulse(p)

  // [4. Hover/click del título.]
  titleEnterHandler = () => applyTitleHoverClick(h1, chars)
  titleClickHandler = () => applyTitleHoverClick(h1, chars)
  h1.addEventListener('mouseenter', titleEnterHandler)
  h1.addEventListener('click', titleClickHandler)

  // [5. CTA hover + click.]
  if (cta) {
    ctaEnterHandler = () => ctaHoverIn(cta)
    ctaLeaveHandler = () => ctaHoverOut(cta)
    ctaClickHandler = () => {
      // [Click reinicia el ciclo del título también (botón = trigger H1 fall).]
      ctaClick(cta)
      playTitleFall(chars, h1)
    }
    cta.addEventListener('mouseenter', ctaEnterHandler)
    cta.addEventListener('mouseleave', ctaLeaveHandler)
    cta.addEventListener('click', ctaClickHandler)
  }
})

// [Limpieza: matar tweens y listeners para evitar leaks al cambiar de ruta.]
onBeforeUnmount(() => {
  titleFallTl?.kill()
  titlePulseTw?.kill()
  titleHoverTl?.kill()
  descPulseTw?.kill()
  ctaHoverTw?.kill()
  ctaClickTl?.kill()
  if (restartTimeout) clearTimeout(restartTimeout)

  if (titleEl.value && titleEnterHandler) titleEl.value.removeEventListener('mouseenter', titleEnterHandler)
  if (titleEl.value && titleClickHandler) titleEl.value.removeEventListener('click', titleClickHandler)
  if (ctaEl.value && ctaEnterHandler) ctaEl.value.removeEventListener('mouseenter', ctaEnterHandler)
  if (ctaEl.value && ctaLeaveHandler) ctaEl.value.removeEventListener('mouseleave', ctaLeaveHandler)
  if (ctaEl.value && ctaClickHandler) ctaEl.value.removeEventListener('click', ctaClickHandler)
})
</script>

<template>
  <!--
    [<section> con aria-label — landmark accesible.]
    [min-h-screen — full viewport. overflow-hidden — particles no rebosan.]
  -->
  <section
    id="hero"
    aria-label="Sección de bienvenida"
    :class="[
      'relative flex flex-col items-center justify-center min-h-screen px-4 text-center overflow-hidden',
      gradientClass,
    ]"
  >
    <!--
      [Capa 1 (z-0): burbujas grandes con paralax-mouse + drift GSAP. Decorativo.]
      [Solo en cliente y solo si NO reduce-motion.]
    -->
    <ClientOnly>
      <BubblesBackground
        v-if="!prefersReducedMotion"
        class="z-0"
        :count="10"
        :min-size="100"
        :max-size="260"
      />
    </ClientOnly>

    <!--
      [Capa 2 (z-0): partículas pequeñas linkeadas. Combina con burbujas para profundidad.]
      [a11y/perf: ClientOnly + v-if — Particles solo en cliente y solo si NO se prefiere reducir movimiento.]
      [SSR-safe: NuxtParticles no se monta en server.]
    -->
    <ClientOnly>
      <NuxtParticles
        v-if="!prefersReducedMotion"
        id="hero-particles"
        class="absolute inset-0 z-0 pointer-events-none"
        :options="particlesOptions"
      />
    </ClientOnly>

    <div class="relative z-10 max-w-4xl space-y-6">
      <!--
        [cursor-pointer + select-none — feedback de interactividad para el char-fall click.]
        [will-change — pista al compositor (perf de animación).]
        [white-space-nowrap evita que un char salga de línea durante la caída.]
      -->
      <h1
        ref="titleEl"
        class="anim-title text-[clamp(3rem,8vw,5rem)] font-extrabold leading-tight tracking-tight
               text-gray-900 dark:text-white cursor-pointer select-none"
      >
        Hola, soy
        <span :class="isDark ? 'text-blue-300' : 'text-pink-700'">
          Tu&nbsp;Nombre
        </span>
      </h1>

      <p
        ref="descEl"
        class="anim-desc text-xl md:text-2xl font-medium text-gray-700 dark:text-gray-200"
      >
        Desarrolladora Frontend apasionada por el diseño limpio y funcional
      </p>

      <!--
        [NuxtLink (dep: vue-router) — navegación SPA con prefetch.]
        [a11y: aria-label, focus-visible:ring.]
        [Function ref — NuxtLink es componente; ref normal devuelve la instancia.
         GSAP necesita el HTMLElement: extraemos con `.$el`.]
      -->
      <NuxtLink
        :ref="(el: any) => { ctaEl = el?.$el ?? el }"
        to="#contact"
        aria-label="Ir a la sección de contacto"
        :class="[
          'inline-flex items-center gap-2 px-6 py-3 rounded-md font-semibold',
          'transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'text-white',
          isDark
            ? 'bg-blue-500 hover:bg-blue-400 focus-visible:ring-blue-300'
            : 'bg-pink-600 hover:bg-pink-500 focus-visible:ring-pink-400',
        ]"
      >
        <AppIcon :icon="['fas', 'paper-plane']" :aria-hidden="true" />
        <span>Contáctame</span>
      </NuxtLink>

      <!-- [Descarga de CV — junto al CTA. URL configurable.] -->
      <div class="mt-2">
        <CvDownloadButton />
      </div>
    </div>
  </section>
</template>

<style scoped>
/* [El char-wrap se inyecta dinámicamente; aseguramos display inline-block desde CSS por si JS llega tarde.] */
.anim-title :deep(.char-wrap) {
  display: inline-block;
  will-change: transform, opacity;
}
.anim-title { transform-origin: center center; }
.anim-desc { transform-origin: center center; }
</style>
