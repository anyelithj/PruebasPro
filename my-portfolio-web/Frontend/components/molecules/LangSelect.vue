<!--
  [Atomic Design: Molecule — selector de idioma con bandera (SVG inline).]
  [Patrón: Custom listbox accesible (button + ul role="listbox").]
  [Razón: <select> nativo no renderiza SVG/imágenes. Custom dropdown sí.]
  [a11y: role="combobox"/"listbox", aria-expanded, aria-activedescendant, soporte teclado (↑↓ Enter Esc).]
-->
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import FlagIcon from '~/components/atoms/FlagIcon.vue'

export interface LangOption {
  code: string
  name: string
}

const props = defineProps<{
  modelValue: string
  options: LangOption[]
  variant?: 'desktop' | 'mobile'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
}>()

const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)
const buttonEl = ref<HTMLButtonElement | null>(null)
const listEl = ref<HTMLUListElement | null>(null)
const activeIndex = ref(0)

const selected = computed(() =>
  props.options.find((o) => o.code === props.modelValue) ?? props.options[0],
)

function toggle() {
  open.value ? close() : openMenu()
}

function openMenu() {
  open.value = true
  // [Posiciona el cursor del listbox en el seleccionado.]
  activeIndex.value = Math.max(
    0,
    props.options.findIndex((o) => o.code === props.modelValue),
  )
  nextTick(() => {
    listEl.value?.focus()
  })
}

function close() {
  open.value = false
  nextTick(() => buttonEl.value?.focus())
}

function pick(code: string) {
  emit('update:modelValue', code)
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      openMenu()
    }
    return
  }
  const len = props.options.length
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      activeIndex.value = (activeIndex.value + 1) % len
      break
    case 'ArrowUp':
      e.preventDefault()
      activeIndex.value = (activeIndex.value - 1 + len) % len
      break
    case 'Home':
      e.preventDefault()
      activeIndex.value = 0
      break
    case 'End':
      e.preventDefault()
      activeIndex.value = len - 1
      break
    case 'Enter':
    case ' ':
      e.preventDefault()
      pick(props.options[activeIndex.value].code)
      break
    case 'Escape':
      e.preventDefault()
      close()
      break
  }
}

// [Cierra al hacer click fuera.]
function onDocClick(e: MouseEvent) {
  if (!open.value || !rootEl.value) return
  if (!rootEl.value.contains(e.target as Node)) close()
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))

// [Cuando cambia el modelo desde afuera, sincroniza activeIndex.]
watch(
  () => props.modelValue,
  () => {
    activeIndex.value = Math.max(
      0,
      props.options.findIndex((o) => o.code === props.modelValue),
    )
  },
)
</script>

<template>
  <div ref="rootEl" class="lang-select" :class="variant === 'mobile' ? 'is-mobile' : 'is-desktop'">
    <button
      ref="buttonEl"
      type="button"
      class="lang-btn"
      :aria-haspopup="'listbox'"
      :aria-expanded="open"
      :aria-label="`Idioma actual: ${selected?.name}`"
      @click="toggle"
      @keydown="onKeydown"
    >
      <FlagIcon :code="selected?.code ?? 'es'" :label="selected?.name" :size="20" />
      <span class="lang-name">{{ selected?.name }}</span>
      <svg class="lang-caret" :class="{ 'is-open': open }" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <transition name="lang-pop">
      <ul
        v-if="open"
        ref="listEl"
        class="lang-list"
        role="listbox"
        tabindex="-1"
        :aria-activedescendant="`lang-opt-${options[activeIndex]?.code}`"
        @keydown="onKeydown"
      >
        <li
          v-for="(opt, i) in options"
          :key="opt.code"
          :id="`lang-opt-${opt.code}`"
          role="option"
          :aria-selected="opt.code === modelValue"
          :class="['lang-opt', { 'is-active': i === activeIndex, 'is-selected': opt.code === modelValue }]"
          @mouseenter="activeIndex = i"
          @click="pick(opt.code)"
        >
          <FlagIcon :code="opt.code" :label="opt.name" :size="20" />
          <span>{{ opt.name }}</span>
        </li>
      </ul>
    </transition>
  </div>
</template>

<style scoped>
.lang-select {
  position: relative;
  display: inline-block;
}

.lang-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid rgb(209 213 219);
  background: rgb(243 244 246);
  color: rgb(31 41 55);
  padding: 0.25rem 0.6rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
  cursor: pointer;
  transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.lang-btn:hover {
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.5);
  transform: translateY(-1px);
}

.lang-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.8);
}

.is-mobile .lang-btn {
  flex: 1;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border-color: rgb(55 65 81);
  background: rgb(31 41 55);
  color: #fff;
  font-size: 1rem;
}

:global(.dark) .lang-btn,
.is-mobile .lang-btn {
  border-color: rgb(55 65 81);
  background: rgb(31 41 55);
  color: #fff;
}

.lang-caret {
  transition: transform 0.25s ease;
}

.lang-caret.is-open {
  transform: rotate(180deg);
}

.lang-list {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 9rem;
  max-height: 16rem;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0.25rem;
  background: #fff;
  border: 1px solid rgb(209 213 219);
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px -10px rgba(0, 0, 0, 0.3);
  z-index: 60;
  outline: none;
}

:global(.dark) .lang-list,
.is-mobile .lang-list {
  background: rgb(31 41 55);
  border-color: rgb(55 65 81);
  color: #fff;
}

.is-mobile .lang-list {
  left: 0;
  right: auto;
}

.lang-opt {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.6rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.lang-opt:hover,
.lang-opt.is-active {
  background: rgb(243 244 246);
  transform: translateX(2px);
}

:global(.dark) .lang-opt:hover,
:global(.dark) .lang-opt.is-active,
.is-mobile .lang-opt:hover,
.is-mobile .lang-opt.is-active {
  background: rgba(99, 102, 241, 0.2);
}

.lang-opt.is-selected {
  font-weight: 600;
  color: rgb(99 102 241);
}

/* [Transición del popover.] */
.lang-pop-enter-active,
.lang-pop-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.lang-pop-enter-from,
.lang-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .lang-btn,
  .lang-caret,
  .lang-opt,
  .lang-pop-enter-active,
  .lang-pop-leave-active {
    transition: none !important;
    transform: none !important;
  }
}
</style>
