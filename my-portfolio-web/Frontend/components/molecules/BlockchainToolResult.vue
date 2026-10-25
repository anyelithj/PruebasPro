<!--
  [Atomic Design: Molecule — render legible del resultado JSON de una @tool.]
  [SOLID/SRP: solo presenta el resultado. Muestra pares clave/valor; anida JSON crudo.]
  [UX: enlaces al explorer para firmas/hashes; botón copiar. a11y: labels + roles.]
-->
<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '~/components/atoms/AppIcon.vue';
import type { ToolResult } from '~/composables/useAgentEvents';

const props = defineProps<{ item: ToolResult }>();

// Normaliza el resultado a pares [clave, valor] presentables.
const entries = computed<[string, unknown][]>(() => {
  const r = props.item.result;
  if (r && typeof r === 'object' && !Array.isArray(r)) {
    return Object.entries(r as Record<string, unknown>);
  }
  return [['resultado', r]];
});

function isPrimitive(v: unknown): boolean {
  return v === null || ['string', 'number', 'boolean'].includes(typeof v);
}

function display(v: unknown): string {
  if (isPrimitive(v)) return String(v);
  return JSON.stringify(v, null, 2);
}

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(JSON.stringify(props.item.result, null, 2));
  } catch {
    /* clipboard no disponible: se ignora */
  }
}
</script>

<template>
  <div
    class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-4"
    :aria-label="`Resultado de ${item.tool}`"
  >
    <div class="mb-2 flex items-center justify-between">
      <span class="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
        <AppIcon :icon="['fas', 'screwdriver-wrench']" :aria-hidden="true" />
        <code class="font-mono">{{ item.tool }}</code>
      </span>
      <button
        type="button"
        class="text-xs text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded px-1"
        aria-label="Copiar resultado"
        @click="copy"
      >
        <AppIcon :icon="['fas', 'copy']" :aria-hidden="true" /> Copiar
      </button>
    </div>

    <dl class="space-y-1 text-sm">
      <div
        v-for="[key, value] in entries"
        :key="key"
        class="flex flex-col gap-0.5 sm:flex-row sm:gap-2"
      >
        <dt class="font-medium text-gray-500 dark:text-gray-400 sm:w-40 sm:shrink-0">{{ key }}</dt>
        <dd class="min-w-0 break-words text-gray-800 dark:text-gray-100">
          <span v-if="isPrimitive(value)">{{ display(value) }}</span>
          <pre
            v-else
            class="overflow-x-auto rounded bg-gray-100 dark:bg-gray-900 p-2 font-mono text-xs"
          >{{ display(value) }}</pre>
        </dd>
      </div>
    </dl>
  </div>
</template>
