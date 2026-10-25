<!--
  Input.vue (Vue 3 + Vee-Validate) => campo de formulario accesible conectado al formulario padre por "name"
  (useField de Vee-Validate: valor, error y "touched" sin repetir código en cada formulario: DRY).
  Un solo componente para input, textarea, select y checkbox (patrón Factory por "as"). Los mensajes de error son
  CLAVES de i18n (los schemas Zod usan claves) y se traducen aquí.
  Accesibilidad: <label for>, aria-invalid, aria-describedby (ayuda + error) y role="alert" en el error (WCAG 3.3.1).
-->
<script setup lang="ts">
import { computed, useId } from "vue";
import { useField } from "vee-validate";
import { useI18n } from "#imports";
import { cn } from "../lib/cn";
import type { Option } from "../types/common.types";

const props = withDefaults(
  defineProps<{
    name: string;
    label: string;
    as?: "input" | "textarea" | "select" | "checkbox";
    type?: string;
    hint?: string;
    options?: readonly Option[];
    placeholder?: string;
    rows?: number;
  }>(),
  { as: "input", type: "text", hint: undefined, options: () => [], placeholder: undefined, rows: 4 }
);

const { t, te } = useI18n();
// useField => registra el campo en el useForm del padre; "() => props.name" mantiene la reactividad del nombre
const { value, errorMessage, handleBlur } = useField<unknown>(() => props.name, undefined, props.as === "checkbox" ? { type: "checkbox", checkedValue: true, uncheckedValue: false } : {});
const id = useId();
// text => vista del valor para input/textarea/select (su v-model nativo exige string | number)
const text = computed({ get: () => value.value as string | number | null, set: (next) => (value.value = next) });
const error = computed(() => (errorMessage.value && te(errorMessage.value) ? t(errorMessage.value) : errorMessage.value));
const describedBy = computed(() => [props.hint ? `${id}-hint` : null, error.value ? `${id}-error` : null].filter(Boolean).join(" ") || undefined);
const control = computed(() => cn("w-full rounded-md border bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", error.value ? "border-red-600" : "border-slate-300"));
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="as === 'checkbox'" :for="id" class="flex min-h-9 items-center gap-2 text-sm">
      <input :id="id" v-model="value" type="checkbox" class="size-4" :aria-describedby="describedBy" @blur="handleBlur" >
      {{ label }}
    </label>
    <template v-else>
      <label :for="id" class="text-sm font-medium text-slate-800">{{ label }}</label>
      <textarea v-if="as === 'textarea'" :id="id" v-model="text" :rows="rows" :class="cn(control, 'py-2')" :aria-invalid="Boolean(error) || undefined" :aria-describedby="describedBy" @blur="handleBlur" />
      <select v-else-if="as === 'select'" :id="id" v-model="text" :class="cn(control, 'h-9')" :aria-invalid="Boolean(error) || undefined" :aria-describedby="describedBy" @blur="handleBlur">
        <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
      <input v-else :id="id" v-model="text" :type="type" :placeholder="placeholder" :class="cn(control, 'h-9')" :aria-invalid="Boolean(error) || undefined" :aria-describedby="describedBy" @blur="handleBlur" >
    </template>
    <p v-if="hint" :id="`${id}-hint`" class="text-xs text-slate-500">{{ hint }}</p>
    <p v-if="error" :id="`${id}-error`" role="alert" class="text-sm text-red-700">{{ error }}</p>
  </div>
</template>
