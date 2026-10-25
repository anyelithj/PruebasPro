<!--
  ActionButton.vue (Vue 3 + Tailwind) => acción de fila SOLO con ícono (ver, editar, archivar...): todas miden lo mismo
  (36×36) sin importar el largo del texto. Espejo de IconAction de Next.js (AdminResource.tsx): mismos íconos
  (manifiesto compartido @ecommerce/shared-types) y mismas variantes. Patrón Decorator sobre Button (le agrega ícono +
  texto accesible). Accesibilidad: el texto queda para lectores de pantalla (sr-only) y como tooltip nativo (title).
-->
<script setup lang="ts">
import type { AdminNav } from "@ecommerce/shared-types";
import navData from "@ecommerce/shared-types/admin-nav.json";
import Button from "./Button.vue";

// "defineProps" con valores por defecto => icono, texto accesible, destino opcional (enlace) y variante visual
// "variant" se acepta por compatibilidad y se ignora: TODAS las acciones de fila con el mismo diseño (igual que Next).
// "disabled" => la acción se ve en todas las filas, bloqueada donde no aplica.
withDefaults(defineProps<{ icon: string; label: string; to?: string; variant?: "secondary" | "dangerOutline"; disabled?: boolean }>(), { to: undefined, variant: "secondary", disabled: false });
defineEmits<{ click: [] }>(); // Evento tipado: el padre decide qué hacer (Command)
const ICONS = (navData as AdminNav).icons;
</script>

<template>
  <Button size="icon" variant="secondary" :to="to" :disabled="disabled" :title="label" :class="icon === 'delete' && 'hover:text-red-700'" @click="$emit('click')">
    <!-- eslint-disable-next-line vue/no-v-html -- SVG estático versionado en el repo (manifiesto compartido), nunca datos del usuario -->
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true" v-html="ICONS[icon] ?? ''" />
    <span class="sr-only">{{ label }}</span>
  </Button>
</template>
