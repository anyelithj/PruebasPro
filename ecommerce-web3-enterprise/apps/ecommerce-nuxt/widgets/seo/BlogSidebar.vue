<!--
  BlogSidebar.vue (widget) => filtros del blog por categoría y etiqueta con su conteo, calculados en memoria a partir
  de los posts ya cargados (sin otra consulta). Los filtros son ENLACES con query string: compartibles, indexables y
  funcionan sin JavaScript. Patrón Composite + función pura de agregación (countBy).
-->
<script setup lang="ts">
import { computed } from "vue";
import type { BlogPost } from "~~/entities/blog/model/blog.types";
import { routes } from "~~/shared/constants/routes";

const props = defineProps<{ posts: BlogPost[]; active?: { category?: string | undefined; tag?: string | undefined } }>();
const localePath = useLocalePath();

// countBy => { valor: cantidad } ordenado de mayor a menor (función pura)
const countBy = (values: string[]) => Object.entries(values.reduce<Record<string, number>>((acc, value) => ({ ...acc, [value]: (acc[value] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
const categories = computed(() => countBy(props.posts.map((post) => post.category)));
const tags = computed(() => countBy(props.posts.flatMap((post) => post.tags)).slice(0, 15));
</script>

<template>
  <aside class="flex flex-col gap-6" :aria-label="$t('blog.filters')">
    <section>
      <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{{ $t("blog.categories") }}</h2>
      <ul class="flex flex-col gap-1 text-sm">
        <li><NuxtLink :to="localePath(routes.blog)" class="hover:underline" :aria-current="!active?.category && !active?.tag ? 'page' : undefined">{{ $t("blog.all") }}</NuxtLink></li>
        <li v-for="[name, count] in categories" :key="name">
          <NuxtLink :to="{ path: localePath(routes.blog), query: { category: name } }" class="hover:underline" :aria-current="active?.category === name ? 'page' : undefined">{{ name }} ({{ count }})</NuxtLink>
        </li>
      </ul>
    </section>
    <section v-if="tags.length">
      <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{{ $t("blog.tags") }}</h2>
      <ul class="flex flex-wrap gap-2 text-xs">
        <li v-for="[name] in tags" :key="name">
          <NuxtLink :to="{ path: localePath(routes.blog), query: { tag: name } }" :class="['rounded-full px-3 py-1', active?.tag === name ? 'bg-brand text-white' : 'bg-slate-100 hover:bg-slate-200']">#{{ name }}</NuxtLink>
        </li>
      </ul>
    </section>
  </aside>
</template>
