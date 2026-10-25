<!--
  [Atomic Design: Atom — badge de cadena. Solana (morado) | Ethereum (azul).]
  [SOLID/SRP: solo presenta la cadena. OCP: nueva cadena = ampliar el mapa.]
  [a11y: role/aria-label describen la cadena; color no es el único indicador (icono + texto).]
-->
<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';
import type { Chain } from '~/composables/useBlockchain';

const props = withDefaults(
  defineProps<{ chain: Chain; size?: 'sm' | 'md' }>(),
  { size: 'md' },
);

// [Strategy via mapa] — estilo e icono por cadena, sin if-else.
const META = {
  solana: {
    label: 'Solana',
    icon: ['fas', 'bolt'] as [string, string],
    classes: 'bg-purple-100 text-purple-700 ring-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:ring-purple-700',
  },
  ethereum: {
    label: 'Ethereum',
    icon: ['fab', 'ethereum'] as [string, string],
    classes: 'bg-blue-100 text-blue-700 ring-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:ring-blue-700',
  },
} as const;

const meta = computed(() => META[props.chain]);
const sizeClass = computed(() =>
  props.size === 'sm' ? 'text-xs px-2 py-0.5 gap-1' : 'text-sm px-3 py-1 gap-1.5',
);
</script>

<template>
  <span
    role="img"
    :aria-label="`Cadena ${meta.label}`"
    :class="[
      'inline-flex items-center rounded-full font-semibold ring-1',
      meta.classes,
      sizeClass,
    ]"
  >
    <AppIcon :icon="meta.icon" :aria-hidden="true" />
    {{ meta.label }}
  </span>
</template>
