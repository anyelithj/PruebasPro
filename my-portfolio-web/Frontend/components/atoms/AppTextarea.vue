<!--
  [Atomic Design: Atom — textarea reutilizable.]
  [Patrón: Presentational + custom v-model.]
  [a11y: label, aria-invalid, aria-describedby.]
  [Animaciones: mismas que AppInput — focus glow, underline, shake en error.]
-->
<script setup lang="ts">
withDefaults(
  defineProps<{
    id: string
    label: string
    modelValue: string
    rows?: number
    placeholder?: string
    error?: string
  }>(),
  { rows: 4, placeholder: '' },
)

defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>

<template>
  <div class="app-textarea-wrap" :class="{ 'has-error': !!error }">
    <label :for="id" class="app-label block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
      {{ label }}
    </label>
    <div class="app-input-shell">
      <textarea
        :id="id"
        :rows="rows"
        :value="modelValue"
        :placeholder="placeholder"
        :aria-invalid="!!error"
        :aria-describedby="error ? `${id}-error` : undefined"
        class="app-textarea w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600
               bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow-sm
               focus:outline-none transition-all duration-300 resize-y"
        @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      />
      <span class="app-input-glow" aria-hidden="true" />
      <span class="app-input-bar" aria-hidden="true" />
    </div>
    <p v-if="error" :id="`${id}-error`" role="alert" class="app-error text-red-500 text-xs mt-1">
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.app-textarea-wrap {
  position: relative;
}

.app-label {
  transition: color 0.25s ease, transform 0.25s ease;
  transform-origin: left center;
}

.app-textarea-wrap:focus-within .app-label {
  color: rgb(99 102 241);
  transform: translateY(-2px);
}

.app-input-shell {
  position: relative;
}

.app-textarea {
  position: relative;
  z-index: 1;
}

.app-textarea:focus {
  border-color: rgb(129 140 248);
  box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.25);
}

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

.app-textarea-wrap:focus-within .app-input-glow {
  opacity: 1;
}

.app-input-bar {
  position: absolute;
  left: 50%;
  right: 50%;
  bottom: 4px;
  height: 2px;
  background: linear-gradient(90deg, #a562ff, #3b82f6);
  border-radius: 9999px;
  transition: left 0.3s ease, right 0.3s ease;
  pointer-events: none;
  z-index: 2;
}

.app-textarea-wrap:focus-within .app-input-bar {
  left: 8px;
  right: 8px;
}

.app-textarea-wrap.has-error .app-textarea {
  border-color: rgb(239 68 68);
  animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

.app-textarea-wrap.has-error .app-input-glow {
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
  .app-textarea,
  .app-input-glow,
  .app-input-bar,
  .app-error {
    transition: none !important;
    animation: none !important;
    transform: none !important;
  }
}
</style>
