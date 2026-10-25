<!--
  [Atomic Design: Atom (illustration) — SVG vectorial autocontenido.]
  [Patrón: Renderless-friendly — todo es <svg>, sin lógica de negocio.]
  [Performance: vectorial → escala infinita, peso constante, sin requests externos.]
  [a11y: role="img" + aria-label + <title>/<desc> embebidos.]
  [Animaciones: SOLO entrada con stagger, código tipea/borra, ojos parpadean,
   cursor parpadea, iconos flotan. Estrella, vapor, planta y flor estáticos.]
-->
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import gsap from 'gsap'
import { useReducedMotion } from '~/composables/useReducedMotion'

const svgRef = ref<SVGSVGElement | null>(null)
const { prefersReducedMotion } = useReducedMotion()

let timelines: gsap.core.Tween[] = []
let masterTl: gsap.core.Timeline | null = null

onMounted(() => {
  if (!svgRef.value) return
  if (prefersReducedMotion.value) return

  const root = svgRef.value

  // [Entrada del SVG.]
  timelines.push(
    gsap.from(root, {
      opacity: 0,
      y: 30,
      scale: 0.96,
      duration: 1.1,
      ease: 'power2.out',
    }),
  )

  // [Stagger en sub-grupos.]
  const animatedNodes = root.querySelectorAll('[data-anim]')
  if (animatedNodes.length > 0) {
    timelines.push(
      gsap.from(animatedNodes, {
        opacity: 0,
        y: 12,
        duration: 0.6,
        stagger: 0.08,
        delay: 0.4,
        ease: 'power2.out',
      }),
    )
  }

  // [Cursor parpadeante.]
  const cursor = root.querySelector('[data-cursor]')
  if (cursor) {
    timelines.push(
      gsap.to(cursor, {
        opacity: 0,
        repeat: -1,
        yoyo: true,
        duration: 0.5,
        ease: 'steps(1)',
      }),
    )
  }

  // [Parpadeo de ojos.]
  const eyes = root.querySelectorAll('[data-eye]')
  eyes.forEach((eye) => {
    gsap.set(eye, { transformOrigin: 'center center', transformBox: 'fill-box' })
    timelines.push(
      gsap.to(eye, {
        scaleY: 0.08,
        duration: 0.12,
        repeat: -1,
        yoyo: true,
        repeatDelay: 3.2,
        ease: 'power1.inOut',
      }),
    )
  })

  // [Iconos flotantes — float vertical (estrella NO incluida; estrella estática).]
  const floaters = root.querySelectorAll('[data-float]')
  floaters.forEach((f, i) => {
    timelines.push(
      gsap.to(f, {
        y: '-=6',
        duration: 1.8 + i * 0.2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: i * 0.25,
      }),
    )
  })

  // [Código tipea/borra en bucle.]
  const lines = Array.from(root.querySelectorAll<SVGTextElement>('[data-code]'))
  if (lines.length > 0) {
    const fullTexts = lines.map((el) => el.textContent ?? '')
    lines.forEach((el) => (el.textContent = ''))

    masterTl = gsap.timeline({ repeat: -1, repeatDelay: 2 })

    fullTexts.forEach((text, idx) => {
      const el = lines[idx]
      masterTl!.to(
        { i: 0 },
        {
          i: text.length,
          duration: Math.max(0.4, text.length * 0.035),
          ease: 'none',
          onUpdate() {
            const n = Math.round(this.targets()[0].i)
            el.textContent = text.slice(0, n)
          },
        },
        idx === 0 ? 0 : '+=0.05',
      )
    })

    masterTl.to({}, { duration: 1.2 })

    masterTl.to(
      { i: Math.max(...fullTexts.map((t) => t.length)) },
      {
        i: 0,
        duration: 0.9,
        ease: 'none',
        onUpdate() {
          const n = Math.round(this.targets()[0].i)
          lines.forEach((el, idx) => {
            el.textContent = fullTexts[idx].slice(0, Math.min(n, fullTexts[idx].length))
          })
        },
      },
    )
  }
})

onBeforeUnmount(() => {
  timelines.forEach((t) => t.kill())
  masterTl?.kill()
  timelines = []
  masterTl = null
})
</script>

<template>
  <div class="w-full max-w-md mx-auto">
    <svg
      ref="svgRef"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 500"
      class="w-full h-auto"
      role="img"
      aria-labelledby="dev-svg-title dev-svg-desc"
    >
      <title id="dev-svg-title">Desarrolladora trabajando con un laptop</title>
      <desc id="dev-svg-desc">
        Ilustración animada de una desarrolladora con laptop, escritorio, taza de café y planta con girasol.
      </desc>

      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#FED84B" stop-opacity="0.35" />
          <stop offset="50%" stop-color="#A562FF" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#F970FE" stop-opacity="0.35" />
        </linearGradient>
        <linearGradient id="laptopGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#7e22ce" />
          <stop offset="100%" stop-color="#3b82f6" />
        </linearGradient>
        <linearGradient id="hairGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3b1e1e" />
          <stop offset="100%" stop-color="#5e2a2a" />
        </linearGradient>
        <linearGradient id="shirtGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#A562FF" />
          <stop offset="100%" stop-color="#7e22ce" />
        </linearGradient>
        <linearGradient id="steamGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="#e2e8f0" stop-opacity="0.95" />
          <stop offset="60%" stop-color="#f1f5f9" stop-opacity="0.75" />
          <stop offset="100%" stop-color="#f8fafc" stop-opacity="0" />
        </linearGradient>
        <radialGradient id="petalGrad" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stop-color="#fde047" />
          <stop offset="100%" stop-color="#f59e0b" />
        </radialGradient>
      </defs>

      <!-- Halo de fondo -->
      <circle cx="250" cy="240" r="210" fill="url(#bgGrad)" />

      <!-- Escritorio -->
      <rect data-anim x="60" y="370" width="380" height="14" rx="3" fill="#cbd5e1" />
      <rect x="60" y="384" width="380" height="6" fill="#94a3b8" />

      <!-- Planta — composición compacta. Maceta + tallos + 2 hojas + flor pequeña tipo rosa. -->
      <g data-anim>
        <!-- Maceta. -->
        <rect x="90" y="335" width="40" height="35" rx="4" fill="#f97316" />
        <!-- Tallos curvos suaves. -->
        <path d="M110 335 C 95 305, 105 280, 110 270" stroke="#16a34a" stroke-width="4" fill="none" stroke-linecap="round" />
        <path d="M110 335 C 125 310, 120 285, 110 275" stroke="#22c55e" stroke-width="4" fill="none" stroke-linecap="round" />
        <!-- Hojas. -->
        <ellipse cx="103" cy="290" rx="9" ry="6" fill="#22c55e" transform="rotate(-30 103 290)" />
        <ellipse cx="118" cy="295" rx="9" ry="6" fill="#16a34a" transform="rotate(30 118 295)" />
        <!-- Flor (rosa pequeña) en la punta del tallo principal. -->
        <g transform="translate(110 268)">
          <ellipse cx="0" cy="-5" rx="3" ry="4.5" fill="#f472b6" />
          <ellipse cx="0" cy="-5" rx="3" ry="4.5" fill="#ec4899" transform="rotate(72)" />
          <ellipse cx="0" cy="-5" rx="3" ry="4.5" fill="#f472b6" transform="rotate(144)" />
          <ellipse cx="0" cy="-5" rx="3" ry="4.5" fill="#ec4899" transform="rotate(216)" />
          <ellipse cx="0" cy="-5" rx="3" ry="4.5" fill="#f472b6" transform="rotate(288)" />
          <circle r="2" fill="#fbbf24" />
        </g>
      </g>

      <!-- Taza de café (derecha) -->
      <g data-anim>
        <rect x="370" y="340" width="40" height="32" rx="3" fill="#f8fafc" stroke="#475569" stroke-width="2" />
        <path d="M410 348 q12 4 0 16" stroke="#475569" stroke-width="2" fill="none" />
        <ellipse cx="390" cy="343" rx="16" ry="3" fill="#7c2d12" />
        <!--
          Vapor — 3 columnas que SOLO crecen (escala). No se desplazan.
          Animadas por data-steam (timeline ráfaga + pausa).
        -->
        <path
          data-steam
          d="M382 335
             C 378 326, 388 320, 384 312
             C 380 304, 390 298, 386 290
             L 388 290
             C 392 298, 382 304, 386 312
             C 390 320, 380 326, 384 335 Z"
          fill="url(#steamGrad)"
        />
        <path
          data-steam
          d="M390 335
             C 386 326, 396 320, 392 312
             C 388 304, 398 298, 394 290
             L 396 290
             C 400 298, 390 304, 394 312
             C 398 320, 388 326, 392 335 Z"
          fill="url(#steamGrad)"
        />
        <path
          data-steam
          d="M398 335
             C 394 326, 404 320, 400 312
             C 396 304, 406 298, 402 290
             L 404 290
             C 408 298, 398 304, 402 312
             C 406 320, 396 326, 400 335 Z"
          fill="url(#steamGrad)"
        />
      </g>

      <!-- Personaje: torso -->
      <g data-anim>
        <path
          d="M180 350 Q200 290 250 290 Q300 290 320 350 L320 380 L180 380 Z"
          fill="url(#shirtGrad)"
        />
        <path d="M205 320 Q190 340 200 360" stroke="#fcd5b4" stroke-width="14" fill="none" stroke-linecap="round" />
        <path d="M295 320 Q310 340 300 360" stroke="#fcd5b4" stroke-width="14" fill="none" stroke-linecap="round" />
      </g>

      <!-- Cabeza -->
      <g data-anim>
        <rect x="240" y="265" width="20" height="30" fill="#fcd5b4" />
        <ellipse cx="250" cy="240" rx="48" ry="55" fill="#fcd5b4" />
        <path
          d="M198 220 Q190 290 220 320 Q210 240 220 200 Q250 175 280 200 Q290 240 280 320 Q310 290 302 220 Q305 165 250 158 Q195 165 198 220 Z"
          fill="url(#hairGrad)"
        />
        <path d="M210 205 Q235 195 260 200 Q285 195 295 215 Q280 200 250 200 Q220 200 210 205 Z" fill="url(#hairGrad)" />
        <circle cx="230" cy="240" r="11" fill="none" stroke="#1f2937" stroke-width="2.5" />
        <circle cx="270" cy="240" r="11" fill="none" stroke="#1f2937" stroke-width="2.5" />
        <line x1="241" y1="240" x2="259" y2="240" stroke="#1f2937" stroke-width="2.5" />
        <circle data-eye cx="230" cy="240" r="2.5" fill="#1f2937" />
        <circle data-eye cx="270" cy="240" r="2.5" fill="#1f2937" />
        <path d="M238 263 Q250 273 262 263" stroke="#1f2937" stroke-width="2" fill="none" stroke-linecap="round" />
        <circle cx="200" cy="248" r="3" fill="#FED84B" />
        <circle cx="300" cy="248" r="3" fill="#FED84B" />
      </g>

      <!-- Laptop sobre el escritorio -->
      <g data-anim>
        <rect x="180" y="365" width="140" height="10" rx="2" fill="#1f2937" />
        <rect x="190" y="305" width="120" height="65" rx="4" fill="#0f172a" stroke="#334155" stroke-width="2" />
        <g font-family="monospace" font-size="6">
          <text data-code x="196" y="316" fill="#7ee787">const dev = {</text>
          <text data-code x="200" y="326" fill="#f0883e">  name: "Tu Nombre",</text>
          <text data-code x="200" y="336" fill="#f0883e">  stack: ["Vue","TS"],</text>
          <text data-code x="200" y="346" fill="#f0883e">  loves: "clean code"</text>
          <text data-code x="196" y="356" fill="#7ee787">}</text>
          <rect data-cursor x="215" y="358" width="5" height="1.5" fill="#7ee787" />
        </g>
        <rect x="190" y="305" width="120" height="3" fill="url(#laptopGrad)" />
      </g>

      <!-- Iconos flotantes -->
      <g data-anim opacity="0.85">
        <text data-float x="105" y="200" font-family="monospace" font-size="22" font-weight="bold" fill="#A562FF">{ }</text>
        <text data-float x="380" y="220" font-family="monospace" font-size="20" font-weight="bold" fill="#3b82f6">&lt;/&gt;</text>
        <!-- Estrella — SOLO rota sobre su eje. -->
        <polygon data-star points="395,140 400,150 411,151 402,159 405,170 395,164 385,170 388,159 379,151 390,150" fill="#FED84B" />
      </g>
    </svg>
  </div>
</template>
