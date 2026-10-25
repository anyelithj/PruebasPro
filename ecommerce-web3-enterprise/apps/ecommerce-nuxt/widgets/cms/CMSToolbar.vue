<!--
  CMSToolbar.vue (widget) => acciones del editor GrapesJS: dispositivo de vista previa, deshacer/rehacer, vista previa
  y guardar. Solo emite eventos (Observer / Command): no conoce GrapesJS, el editor decide qué hacer (SRP).
  Accesibilidad: role="toolbar", botones con aria-pressed para el dispositivo activo y estado de cambios anunciado.
-->
<script setup lang="ts">
import Button from "~~/shared/ui/Button.vue";
import { useCmsStore, type PreviewDevice } from "~~/features/cms/model/cms.store";

defineProps<{ saving: boolean }>();
const emit = defineEmits<{ device: [device: PreviewDevice]; undo: []; redo: []; preview: []; save: [] }>();
const store = useCmsStore();
const DEVICES: PreviewDevice[] = ["desktop", "tablet", "mobile"];
</script>

<template>
  <div role="toolbar" :aria-label="$t('cms.toolbar.label')" class="flex flex-wrap items-center justify-between gap-2 border-b bg-white px-3 py-2">
    <div class="flex gap-1">
      <Button v-for="device in DEVICES" :key="device" size="sm" :variant="store.device === device ? 'primary' : 'secondary'" :aria-pressed="store.device === device" @click="emit('device', device)">
        {{ $t(`cms.toolbar.${device}`) }}
      </Button>
    </div>
    <div class="flex items-center gap-1">
      <Button size="sm" variant="secondary" @click="emit('undo')">{{ $t("cms.toolbar.undo") }}</Button>
      <Button size="sm" variant="secondary" @click="emit('redo')">{{ $t("cms.toolbar.redo") }}</Button>
      <Button size="sm" variant="secondary" @click="emit('preview')">{{ $t("cms.toolbar.preview") }}</Button>
      <span aria-live="polite" class="px-2 text-xs text-slate-500">{{ store.dirty ? $t("cms.toolbar.unsaved") : $t("cms.toolbar.saved") }}</span>
      <Button size="sm" :loading="saving" @click="emit('save')">{{ $t("common.save") }}</Button>
    </div>
  </div>
</template>
