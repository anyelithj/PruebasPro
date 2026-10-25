<!--
  [Atomic Design: Molecule — input de contraseña + botón ver/ocultar.]
  [a11y: el botón anuncia su estado con aria-pressed y aria-label dinámico.]
-->
<script setup lang="ts">
import { ref } from 'vue'

withDefaults(
  defineProps<{
    id: string
    label: string
    modelValue: string
    placeholder?: string
    error?: string
    autocomplete?: string
    minlength?: number
    required?: boolean
  }>(),
  { placeholder: '••••••••', autocomplete: 'current-password', required: true },
)

defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const visible = ref(false)
</script>

<template>
  <div class="pw-field" :class="{ 'has-error': !!error }">
    <label :for="id" class="pw-field__label">{{ label }}</label>

    <div class="pw-field__shell">
      <input
        :id="id"
        :type="visible ? 'text' : 'password'"
        :value="modelValue"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :minlength="minlength"
        :required="required"
        :aria-invalid="!!error"
        :aria-describedby="error ? `${id}-error` : undefined"
        class="pw-field__input"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />

      <button
        type="button"
        class="pw-field__toggle"
        :aria-pressed="visible"
        :aria-label="visible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
        :title="visible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
        @click="visible = !visible"
      >
        <font-awesome-icon :icon="['fas', visible ? 'eye-slash' : 'eye']" />
      </button>
    </div>

    <p v-if="error" :id="`${id}-error`" role="alert" class="pw-field__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.pw-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.pw-field__label {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgb(55 65 81);
}
:global(.dark) .pw-field__label {
  color: rgb(209 213 219);
}
.pw-field__shell {
  position: relative;
}
.pw-field__input {
  width: 100%;
  padding: 0.65rem 2.75rem 0.65rem 0.85rem; /* espacio a la derecha para el ojo */
  border-radius: 0.6rem;
  border: 1px solid rgb(209 213 219);
  background: white;
  color: rgb(17 24 39);
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}
:global(.dark) .pw-field__input {
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(15, 23, 42, 0.6);
  color: white;
}
.pw-field__input:focus {
  outline: none;
  border-color: rgb(129 140 248);
  box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.25);
}
.pw-field__toggle {
  position: absolute;
  top: 50%;
  right: 0.6rem;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 0.4rem;
  background: transparent;
  color: rgb(107 114 128);
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease;
}
.pw-field__toggle:hover {
  color: rgb(99 102 241);
  background: rgba(99, 102, 241, 0.1);
}
.pw-field__toggle:focus-visible {
  outline: 2px solid rgb(99 102 241);
  outline-offset: 2px;
}
.pw-field.has-error .pw-field__input {
  border-color: rgb(239 68 68);
}
.pw-field__error {
  font-size: 0.75rem;
  color: rgb(239 68 68);
}
</style>
