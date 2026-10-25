<!--
  Button.vue (Vue 3 + Tailwind) => botón base del design system. Patrón Factory (variante/tamaño -> clases) y
  polimorfismo: con "to" se dibuja como enlace (NuxtLink, navegación SPA con prefetch) y sin él como <button>.
  Accesibilidad: foco visible (WCAG 2.4.7), área táctil mínima 44 px en "md" (WCAG 2.5.5), aria-busy al cargar.
-->
<script setup lang="ts">
import { computed } from "vue";
import { cn } from "../lib/cn";

// "withDefaults(defineProps<...>())" => props tipadas con valores por defecto (macro del compilador de Vue)
const props = withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "ghost" | "danger" | "dangerOutline";
    size?: "sm" | "md" | "icon"; // "icon" => cuadrado de 36 px (acciones de fila: ancho uniforme)
    type?: "button" | "submit";
    to?: string;
    loading?: boolean;
    disabled?: boolean;
  }>(),
  { variant: "primary", size: "md", type: "button", to: undefined, loading: false, disabled: false }
);

// VARIANTS / SIZES => tablas de estrategia (agregar una variante = una línea: OCP)
const VARIANTS = {
  primary: "bg-brand text-brand-foreground hover:bg-slate-800",
  secondary: "border border-slate-300 bg-white text-slate-800 shadow-sm hover:border-slate-400 hover:bg-slate-100", // igual que Next.js
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "bg-red-700 text-white hover:bg-red-800",
  // dangerOutline => acción destructiva de fila (eliminar/archivar): mismo estilo que la variante de Next.js
  dangerOutline: "border border-red-300 bg-white text-red-700 shadow-sm hover:border-red-400 hover:bg-red-50",
} as const;
const SIZES = { sm: "h-9 px-3 text-sm", md: "h-9 px-4 text-sm", icon: "size-9 shrink-0 p-0" } as const;

// "computed" => las clases se recalculan solo si cambian las props
const classes = computed(() =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[props.variant],
    SIZES[props.size]
  )
);
</script>

<template>
  <NuxtLink v-if="to && !disabled" :to="to" :class="classes"><slot /></NuxtLink>
  <button v-else :type="type" :class="classes" :disabled="disabled || loading" :aria-busy="loading || undefined">
    <!-- Spinner decorativo: el estado lo anuncia aria-busy -->
    <span v-if="loading" class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
    <slot />
  </button>
</template>
