<!--
  [Atomic Design: Atom — pieza UI mínima reutilizable, sin lógica de dominio.]
  [Patrón: Presentational Component — recibe props, emite eventos, no toca estado externo.]
  [SOLID/SRP: solo renderiza un botón con variantes; sin side-effects.]
  [Animaciones: shine sweep, ripple en click, lift en hover, focus glow.]
-->
<script setup lang="ts">
// [vue: <script setup> — sintaxis SFC composition API. Auto-export de bindings al template.]
import { computed, ref } from 'vue'
import { useReducedMotion } from '~/composables/useReducedMotion'

// [typescript: type union — variantes válidas (compile-time guard).]
type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

// [vue: defineProps con generic type — props tipadas estáticamente.]
// [SOLID/OCP: añadir variantes = ampliar union, sin tocar consumidores.]
const props = withDefaults(
  defineProps<{
    variant?: Variant       // [Aspecto visual.]
    size?: Size             // [Tamaño.]
    type?: 'button' | 'submit' | 'reset'  // [Tipo HTML.]
    disabled?: boolean      // [Estado.]
    ariaLabel?: string      // [a11y — label cuando el contenido no es texto.]
  }>(),
  // [vue: withDefaults — defaults tipados para optional props.]
  { variant: 'primary', size: 'md', type: 'button', disabled: false },
)

// [vue: defineEmits — declara eventos emitidos. type-safe.]
const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

// [vue: computed — clases derivadas de props. Lazy + cacheado.]
// [Patrón: Strategy mediante mapa — anti if-else encadenado (clean code).]
const variantClasses = computed<Record<Variant, string>>(() => ({
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-400',
  secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus-visible:ring-gray-400 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600',
  ghost: 'bg-transparent text-gray-800 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-800',
}))

const sizeClasses = computed<Record<Size, string>>(() => ({
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
}))

// [Ripples — lista reactiva de partículas que se montan/desmontan en cada click.]
type Ripple = { id: number; x: number; y: number; size: number }
const ripples = ref<Ripple[]>([])
let rippleId = 0
const { prefersReducedMotion } = useReducedMotion()

// [Handler local — re-emite el click respetando disabled. Encapsula la lógica del botón.]
function onClick(e: MouseEvent) {
  if (props.disabled) return
  if (!prefersReducedMotion.value) spawnRipple(e)
  emit('click', e)
}

function spawnRipple(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement
  const r = target.getBoundingClientRect()
  const size = Math.max(r.width, r.height) * 2.2
  const id = ++rippleId
  ripples.value.push({
    id,
    x: e.clientX - r.left - size / 2,
    y: e.clientY - r.top - size / 2,
    size,
  })
  // [Cleanup tras la animación CSS (600ms).]
  setTimeout(() => {
    ripples.value = ripples.value.filter((r) => r.id !== id)
  }, 650)
}
</script>

<template>
  <!--
    [a11y: aria-disabled refleja disabled; focus-visible:ring para navegación por teclado.]
    [Patrón Renderless-friendly: <slot/> permite contenido arbitrario.]
  -->
  <button
    :type="type"
    :disabled="disabled"
    :aria-disabled="disabled"
    :aria-label="ariaLabel"
    :class="[
      'app-btn relative overflow-hidden isolate inline-flex items-center justify-center gap-2 rounded-md font-semibold',
      'transition-all duration-300 ease-out',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      variantClasses[variant],
      sizeClasses[size],
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0',
    ]"
    @click="onClick"
  >
    <!-- [Shine sweep — gradiente diagonal que cruza el botón en hover.] -->
    <span class="btn-shine" aria-hidden="true" />

    <!-- [Ripples — span con animación scale+fade.] -->
    <span
      v-for="r in ripples"
      :key="r.id"
      class="btn-ripple"
      :style="{ left: `${r.x}px`, top: `${r.y}px`, width: `${r.size}px`, height: `${r.size}px` }"
      aria-hidden="true"
    />

    <!-- vue: <slot/> — composición por contenido. -->
    <span class="relative z-10 inline-flex items-center gap-2">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.app-btn {
  will-change: transform, box-shadow;
}

/* [Shine — barra inclinada que cruza el botón.] */
.btn-shine {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    120deg,
    transparent 0%,
    transparent 35%,
    rgba(255, 255, 255, 0.35) 50%,
    transparent 65%,
    transparent 100%
  );
  transform: translateX(-100%);
  transition: transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  z-index: 1;
}

.app-btn:hover:not(:disabled) .btn-shine {
  transform: translateX(100%);
}

/* [Ripple — círculo blanco translúcido que crece + desvanece.] */
.btn-ripple {
  position: absolute;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.45);
  transform: scale(0);
  opacity: 0.7;
  pointer-events: none;
  animation: ripple 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  z-index: 2;
}

@keyframes ripple {
  to {
    transform: scale(1);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-btn,
  .btn-shine,
  .btn-ripple {
    transition: none !important;
    animation: none !important;
    transform: none !important;
  }
}
</style>
