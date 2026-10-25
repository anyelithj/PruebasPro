<!--
  AdminHeading.vue (Vue 3 + Tailwind) => encabezado de cada pantalla del panel servida por Nuxt, ESPEJO de AdminHeading
  de Next.js (AdminSection.tsx): <h1> + descripción + acciones a la derecha. El título y la descripción salen del
  MISMO manifiesto que el menú (@ecommerce/shared-types/admin-nav.json): lo que dice el menú es lo que dice la página.
  Patrones: Shared Kernel (datos compartidos entre microfrontends), Slot (acciones inyectadas por la página).
  SEO: fija el <title> de la página con el mismo texto (useSeoMeta). Accesibilidad: un único <h1> por pantalla.
-->
<script setup lang="ts">
import { computed } from "vue";
import { useI18n, useSeoMeta } from "#imports"; // shared/ es capa sin auto-imports: se importan explícitos
import type { AdminLocale, AdminNav } from "@ecommerce/shared-types";
import navData from "@ecommerce/shared-types/admin-nav.json";

const props = defineProps<{ navKey: string }>(); // Clave del ítem del menú ("payments", "content"...)
const { locale } = useI18n();
const lang = computed<AdminLocale>(() => (locale.value === "en" ? "en" : "es"));
// "flatMap" => aplana los ítems de todos los grupos para buscar por clave (función pura sobre datos estáticos)
const item = (navData as AdminNav).groups.flatMap((group) => group.items).find((entry) => entry.key === props.navKey);
const title = computed(() => item?.label[lang.value] ?? props.navKey);
useSeoMeta({ title }); // <title> = texto del menú (el sufijo del sitio lo agrega titleTemplate)
</script>

<template>
  <header class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
    <div class="flex flex-col gap-1">
      <h1 class="flex items-center gap-2 text-2xl font-semibold text-slate-900">
        {{ title }}
        <!-- Código RF de la especificación (manifiesto compartido: el mismo que muestra Next.js) -->
        <span v-if="item?.rf" class="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{{ item.rf }}</span>
      </h1>
      <p v-if="item?.description" class="text-sm text-slate-600">{{ item.description[lang] }}</p>
    </div>
    <!-- Slot por defecto => botones de la pantalla ("Nueva página", "Refrescar"...) -->
    <div v-if="$slots.default" class="flex flex-wrap gap-2"><slot /></div>
  </header>
</template>
