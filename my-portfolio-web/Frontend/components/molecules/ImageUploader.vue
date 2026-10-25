<!--
  [Atomic Design: Molecule — subida de imagen a Cloudinary con preview.]
  [SRP: solo UI de subida; la lógica vive en useCloudinary. v-model = URL de la imagen.]
  [a11y: label, estados de carga/error, botón de quitar. UX: preview + drag-free simple.]
-->
<script setup lang="ts">
import { ref } from 'vue';
import { useCloudinary } from '~/composables/useCloudinary';
import { useToast } from '~/composables/useToast';

const props = withDefaults(
  defineProps<{ modelValue?: string | null; label?: string }>(),
  { modelValue: '', label: 'Imagen' },
);
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const { configured, upload } = useCloudinary();
const toast = useToast();

const uploading = ref(false);
const inputEl = ref<HTMLInputElement | null>(null);

function pick(): void {
  inputEl.value?.click();
}

async function onFile(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    const url = await upload(file);
    emit('update:modelValue', url);
    toast.success('Imagen subida');
  } catch (err) {
    toast.error((err as Error).message);
  } finally {
    uploading.value = false;
    if (inputEl.value) inputEl.value.value = '';
  }
}

function remove(): void {
  emit('update:modelValue', '');
}
</script>

<template>
  <div>
    <span class="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">{{ label }}</span>

    <!-- Preview -->
    <div
      v-if="modelValue"
      class="group relative mb-2 overflow-hidden rounded-lg border border-gray-200 dark:border-white/10"
    >
      <img :src="modelValue" alt="Vista previa" class="h-40 w-full object-cover" />
      <button
        type="button"
        class="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
        @click="remove"
      >
        Quitar
      </button>
    </div>

    <div class="flex items-center gap-3">
      <button
        type="button"
        :disabled="uploading"
        class="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/5"
        @click="pick"
      >
        <font-awesome-icon :icon="['fas', uploading ? 'spinner' : 'cloud-arrow-up']" :spin="uploading" />
        {{ uploading ? 'Subiendo…' : modelValue ? 'Cambiar imagen' : 'Subir imagen' }}
      </button>
      <input ref="inputEl" type="file" accept="image/*" class="hidden" @change="onFile" />
    </div>

    <p v-if="!configured" class="mt-1 text-xs text-amber-600 dark:text-amber-400">
      Cloudinary no configurado — define las variables en el .env para habilitar la subida.
    </p>
  </div>
</template>
