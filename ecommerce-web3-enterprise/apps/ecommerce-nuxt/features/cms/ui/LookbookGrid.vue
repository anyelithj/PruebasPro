<!--
  LookbookGrid.vue (Vue 3 + CSS columns) => galería tipo masonry SIN librerías (column-count de CSS) con productos
  etiquetados sobre cada foto (hotspots posicionados en %: siguen en su sitio en cualquier tamaño de pantalla).
  Modo edición: clic sobre la foto => evento "tag" con las coordenadas (el padre elige el producto).
  Rendimiento: imágenes lazy con width/height (sin CLS) y "sizes" para que el navegador pida la variante justa.
  Accesibilidad: cada hotspot es un enlace con nombre ("Ver producto 2 de la foto 1"), foco visible.
-->
<script setup lang="ts">
import type { CmsMedia } from "~~/entities/cms/model/cms.types";
import { routes } from "~~/shared/constants/routes";

const props = withDefaults(defineProps<{ media: CmsMedia[]; editable?: boolean }>(), { editable: false });
const emit = defineEmits<{ tag: [index: number, x: number, y: number]; untag: [index: number, spot: number] }>();
const localePath = useLocalePath();

// onClick => convierte el clic en porcentaje relativo a la imagen (independiente del tamaño en pantalla)
const onClick = (event: MouseEvent, index: number) => {
  if (!props.editable) return;
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
  emit("tag", index, Math.round(((event.clientX - box.left) / box.width) * 100), Math.round(((event.clientY - box.top) / box.height) * 100));
};
</script>

<template>
  <ul class="columns-1 gap-4 sm:columns-2 lg:columns-3">
    <li v-for="(item, index) in media" :key="item.url" class="mb-4 break-inside-avoid">
      <figure class="relative overflow-hidden rounded-lg bg-slate-100">
        <img :src="item.url" :alt="item.alt" :width="item.width ?? undefined" :height="item.height ?? undefined" loading="lazy" sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" :class="['h-auto w-full', editable && 'cursor-crosshair']" @click="onClick($event, index)" >
        <template v-for="(spot, spotIndex) in item.hotspots" :key="spot.productId">
          <button v-if="editable" type="button" class="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white shadow" :style="{ left: `${spot.x}%`, top: `${spot.y}%` }" :aria-label="$t('cms.lookbook.removeTag', { n: spotIndex + 1 })" @click.stop="emit('untag', index, spotIndex)">✕</button>
          <NuxtLink v-else :to="localePath(routes.product(spot.productId))" class="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-900 shadow ring-2 ring-white hover:scale-110 focus-visible:outline-none focus-visible:ring-accent motion-reduce:hover:scale-100" :style="{ left: `${spot.x}%`, top: `${spot.y}%` }" :aria-label="$t('cms.lookbook.viewProduct', { n: spotIndex + 1, photo: index + 1 })">+</NuxtLink>
        </template>
        <figcaption class="sr-only">{{ item.alt }}</figcaption>
      </figure>
    </li>
  </ul>
</template>
