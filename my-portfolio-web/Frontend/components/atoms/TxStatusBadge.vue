<!--
  [Atomic Design: Atom — estado de transacción: pending | confirmed | failed.]
  [SOLID/SRP: solo presenta el estado. a11y: aria-label + icono (no solo color).]
  [Animación: pulse en 'pending', respeta prefers-reduced-motion.]
-->
<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';

export type TxStatus = 'pending' | 'confirmed' | 'failed';

const props = defineProps<{ status: TxStatus }>();

const META = {
  pending: {
    label: 'Pendiente',
    icon: ['fas', 'spinner'] as [string, string],
    classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    pulse: true,
  },
  confirmed: {
    label: 'Confirmada',
    icon: ['fas', 'circle-check'] as [string, string],
    classes: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    pulse: false,
  },
  failed: {
    label: 'Fallida',
    icon: ['fas', 'circle-xmark'] as [string, string],
    classes: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    pulse: false,
  },
} as const;

const meta = computed(() => META[props.status]);
</script>

<template>
  <span
    :aria-label="`Transacción ${meta.label}`"
    :class="[
      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
      meta.classes,
    ]"
  >
    <AppIcon :icon="meta.icon" :class="{ 'tx-pulse': meta.pulse }" :aria-hidden="true" />
    {{ meta.label }}
  </span>
</template>

<style scoped>
.tx-pulse {
  animation: txSpin 1s linear infinite;
}
@keyframes txSpin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .tx-pulse {
    animation: none !important;
  }
}
</style>
