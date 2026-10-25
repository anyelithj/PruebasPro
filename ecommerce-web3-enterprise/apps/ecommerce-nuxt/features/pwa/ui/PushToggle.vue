<!--
  PushToggle.vue (Vue 3 + Push API) => interruptor accesible (role="switch" + aria-checked) para recibir
  notificaciones push. Explica el estado del permiso (bloqueado / no soportado) en lugar de fallar en silencio.
-->
<script setup lang="ts">
import { ref } from "vue";
import { useToast } from "~~/shared/composable/useToast";
import { usePushNotif } from "../composable/usePushNotif";
import { usePwaStore } from "../model/pwa.store";

const store = usePwaStore();
const { enable, disable } = usePushNotif();
const toast = useToast();
const { t } = useI18n();
const busy = ref(false);

const toggle = async () => {
  busy.value = true;
  try {
    if (store.pushEnabled) await disable();
    else if (!(await enable())) toast.info(t("pwa.push.denied"));
  } catch {
    toast.error(t("pwa.push.error"));
  } finally {
    busy.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col gap-2">
    <button type="button" role="switch" :aria-checked="store.pushEnabled" :disabled="busy || store.permission === 'unsupported' || store.permission === 'denied'" class="flex items-center gap-3 text-sm disabled:opacity-50" @click="toggle">
      <span :class="['relative inline-flex h-6 w-11 rounded-full transition-colors', store.pushEnabled ? 'bg-green-600' : 'bg-slate-300']" aria-hidden="true">
        <span :class="['absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none', store.pushEnabled ? 'translate-x-5' : 'translate-x-0.5']" />
      </span>
      {{ $t("pwa.push.label") }}
    </button>
    <p v-if="store.permission === 'denied'" class="text-xs text-red-700">{{ $t("pwa.push.blocked") }}</p>
    <p v-else-if="store.permission === 'unsupported'" class="text-xs text-slate-500">{{ $t("pwa.push.unsupported") }}</p>
  </div>
</template>
