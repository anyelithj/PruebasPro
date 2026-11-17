<!--
  PanelTabs.vue => barra de pestañas ÚNICA del panel, ESPEJO de PanelTabs.tsx (Next.js): los ítems de la sección activa, mismas
  clases (.panel-tab) y misma regla. Sin scroll horizontal: hasta MAX_VISIBLE pestañas (la activa siempre entre ellas) y el
  resto en el Dropdown «Más». Son enlaces reales (una pestaña puede vivir en Next), por eso <nav> + aria-current.
  Accesibilidad: "menu button" WAI-ARIA como UserMenu.vue; Escape cierra y devuelve el foco, clic fuera cierra.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { usePanelNav } from "./usePanelNav";

const MAX_VISIBLE = 5; // Mismo valor en PanelTabs.tsx
const { NAV, active, locale, text, itemHref } = usePanelNav();
const route = useRoute();
const items = computed(() => active.value?.group.items ?? []);
const current = computed(() => active.value?.item);
const visible = computed(() => {
  const head = items.value.slice(0, MAX_VISIBLE);
  return !current.value || head.includes(current.value) ? head : [...head.slice(0, MAX_VISIBLE - 1), current.value];
});
const overflow = computed(() => items.value.filter((item) => !visible.value.includes(item)));

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const close = (focus = false) => {
  open.value = false;
  if (focus) trigger.value?.focus();
};
const onDocument = (event: MouseEvent) => root.value && !root.value.contains(event.target as Node) && close();
onMounted(() => document.addEventListener("click", onDocument));
onBeforeUnmount(() => document.removeEventListener("click", onDocument));
watch(() => route.fullPath, () => close());
</script>

<template>
  <nav v-if="items.length > 1" :aria-label="active?.group.label[locale]" class="panel-tabs">
    <template v-for="item in visible" :key="item.key">
      <NuxtLink v-if="item.app === 'nuxt'" :to="itemHref(item)" class="panel-tab" :aria-current="item === current ? 'page' : undefined">{{ item.label[locale] }}</NuxtLink>
      <a v-else :href="itemHref(item)" class="panel-tab">{{ item.label[locale] }}</a>
    </template>
    <div v-if="overflow.length" ref="root" class="relative" @keydown.esc="close(true)">
      <button ref="trigger" type="button" class="panel-tab" aria-haspopup="menu" :aria-expanded="open" @click="open = !open">
        {{ text("more") }}
        <!-- eslint-disable-next-line vue/no-v-html -- SVG estático del manifiesto -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="size-3.5" aria-hidden="true" v-html="NAV.icons.chevron" />
      </button>
      <div v-show="open" role="menu" class="panel-tabs-menu absolute right-0 z-50 mt-1.5">
        <template v-for="item in overflow" :key="item.key">
          <NuxtLink v-if="item.app === 'nuxt'" :to="itemHref(item)" role="menuitem" class="panel-tab w-full">{{ item.label[locale] }}</NuxtLink>
          <a v-else :href="itemHref(item)" role="menuitem" class="panel-tab w-full">{{ item.label[locale] }}</a>
        </template>
      </div>
    </div>
  </nav>
</template>
