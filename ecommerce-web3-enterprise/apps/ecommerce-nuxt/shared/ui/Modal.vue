<!--
  Modal.vue (Vue 3 + <dialog> nativo de HTML) => diálogo modal accesible SIN librerías: el navegador aporta la
  trampa de foco, el cierre con Escape, el fondo inerte y la devolución del foco (0 KB de JavaScript extra).
  v-model:open (defineModel) controla la apertura. Patrón Observer (watch sobre "open").
-->
<script setup lang="ts">
import { ref, watch, onMounted, useId } from "vue";

defineProps<{ title: string }>();
const open = defineModel<boolean>("open", { default: false }); // defineModel => prop + evento update:open en una línea
const dialog = ref<HTMLDialogElement | null>(null);
const titleId = useId(); // useId => id estable entre SSR y cliente (aria-labelledby)

// sync => abre/cierra el <dialog> real cuando cambia el estado reactivo
const sync = (value: boolean) => {
  if (!dialog.value) return;
  if (value && !dialog.value.open) dialog.value.showModal();
  if (!value && dialog.value.open) dialog.value.close();
};
watch(open, sync);
onMounted(() => sync(open.value));
</script>

<template>
  <!-- @close => Escape o botón cerrar devuelven el estado a false; clic en el fondo (target = dialog) también cierra -->
  <dialog
    ref="dialog"
    class="w-[calc(100%-2rem)] max-w-lg rounded-lg p-0 shadow-xl backdrop:bg-black/40"
    :aria-labelledby="titleId"
    @close="open = false"
    @click.self="open = false"
  >
    <header class="flex items-center justify-between border-b px-5 py-4">
      <h2 :id="titleId" class="text-lg font-semibold">{{ title }}</h2>
      <button type="button" class="rounded-md p-2 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" :aria-label="$t('common.close')" @click="open = false">
        <span aria-hidden="true">✕</span>
      </button>
    </header>
    <!-- El contenido solo existe abierto: los formularios internos no viven ocultos en memoria -->
    <div v-if="open" class="max-h-[70vh] overflow-y-auto px-5 py-4"><slot /></div>
  </dialog>
</template>
