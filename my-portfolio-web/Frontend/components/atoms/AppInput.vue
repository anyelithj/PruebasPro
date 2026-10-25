<!--
  [Atomic Design: Atom — input de texto / email.]
  [Patrón: Presentational con v-model:value (Custom v-model de Vue 3).]
  [a11y: label asociado, aria-invalid + aria-describedby cuando hay error.]
  [Animaciones: label se eleva sutilmente al focus, glow gradiente debajo,
   error shake horizontal.]
-->
<script setup lang="ts">
// [typescript: type union — tipos HTML válidos para este atom.]
type InputType = 'text' | 'email' | 'tel' | 'url'

// [vue: defineProps con tipo + defaults.]
withDefaults(
  defineProps<{
    id: string                 // [Necesario para <label for>.]
    label: string              // [Texto de la etiqueta.]
    modelValue: string         // [v-model — valor controlado.]
    type?: InputType
    placeholder?: string
    error?: string             // [Mensaje de error si validación falla.]
    autocomplete?: string      // [a11y/UX: hints del navegador.]
  }>(),
  { type: 'text', placeholder: '' },
)

// [vue: defineEmits — eventos emitidos. update:modelValue → habilita v-model.]
defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>

<template>
  <div class="app-input-wrap" :class="{ 'has-error': !!error }">
    <!-- a11y: label asociado por for=id. -->
    <label :for="id" class="app-label block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
      {{ label }}
    </label>
    <div class="app-input-shell">
      <input
        :id="id"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :aria-invalid="!!error"
        :aria-describedby="error ? `${id}-error` : undefined"
        class="app-input w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600
               bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow-sm
               focus:outline-none transition-all duration-300"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <!-- [Glow gradiente debajo del input al focus.] -->
      <span class="app-input-glow" aria-hidden="true" />
      <!-- [Underline animado — se expande de centro a los lados al focus.] -->
      <span class="app-input-bar" aria-hidden="true" />
    </div>
    <!-- a11y: id-error referenciado por aria-describedby. role=alert anuncia cambios. -->
    <p
      v-if="error"
      :id="`${id}-error`"
      role="alert"
      class="app-error text-red-500 text-xs mt-1"
    >
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.app-input-wrap {
  position: relative;
}

.app-label {
  transition: color 0.25s ease, transform 0.25s ease;
  transform-origin: left center;
}

.app-input-wrap:focus-within .app-label {
  color: rgb(99 102 241); /* indigo-500 */
  transform: translateY(-2px);
}

.app-input-shell {
  position: relative;
}

.app-input {
  position: relative;
  z-index: 1;
}

.app-input:focus {
  border-color: rgb(129 140 248); /* indigo-400 */
  box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.25);
  transform: translateY(-1px);
}

/* [Glow — gradiente difuso que aparece debajo del input al focus.] */
.app-input-glow {
  position: absolute;
  inset: -4px;
  border-radius: 0.5rem;
  background: linear-gradient(135deg, rgba(165, 98, 255, 0.25), rgba(59, 130, 246, 0.25));
  filter: blur(10px);
  opacity: 0;
  transition: opacity 0.35s ease;
  pointer-events: none;
  z-index: 0;
}

.app-input-wrap:focus-within .app-input-glow {
  opacity: 1;
}

/* [Underline animado bajo el input.] */
.app-input-bar {
  position: absolute;
  left: 50%;
  right: 50%;
  bottom: 0;
  height: 2px;
  background: linear-gradient(90deg, #a562ff, #3b82f6);
  border-radius: 9999px;
  transition: left 0.3s ease, right 0.3s ease;
  pointer-events: none;
  z-index: 2;
}

.app-input-wrap:focus-within .app-input-bar {
  left: 8px;
  right: 8px;
}

/* [Error — shake + glow rojo.] */
.app-input-wrap.has-error .app-input {
  border-color: rgb(239 68 68);
  animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

.app-input-wrap.has-error .app-input-glow {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(239, 68, 68, 0.2));
  opacity: 1;
}

.app-error {
  animation: fadeInDown 0.3s ease-out;
}

@keyframes shake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 50%, 70% { transform: translateX(-4px); }
  40%, 60% { transform: translateX(4px); }
}

@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .app-label,
  .app-input,
  .app-input-glow,
  .app-input-bar,
  .app-error {
    transition: none !important;
    animation: none !important;
    transform: none !important;
  }
}
</style>
