<!--
  Badge.vue => etiqueta de estado (publicado, borrador, plataforma). Patrón Factory: el tono decide las clases.
  Colores con contraste AA; el significado siempre está en el texto, no solo en el color.
-->
<script setup lang="ts">
withDefaults(defineProps<{ tone?: "neutral" | "success" | "warning" | "danger" | "info" }>(), { tone: "neutral" });
const TONES = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
} as const;
</script>

<template>
  <span :class="['inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', TONES[tone]]"><slot /></span>
</template>
