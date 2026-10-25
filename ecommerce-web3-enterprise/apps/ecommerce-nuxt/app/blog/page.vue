<!--
  page.vue (/blog) => listado del blog desde Nuxt Content (SQLite local, 0 peticiones a Express) en SSR + ISR 24 h.
  Filtros por categoría/etiqueta en la URL (validados con Zod) y barra lateral con conteos. Vista cuadrícula/lista
  en Pinia. Patrón Composite (BlogPostCard + BlogSidebar).
-->
<script setup lang="ts">
import { computed } from "vue";
import type { BlogPost } from "~~/entities/blog/model/blog.types";
import { useSEOMeta } from "~~/features/seo/composable/useSEOMeta";
import { blogQuerySchema } from "~~/features/seo/lib/seo.validator";
import { useSeoStore } from "~~/features/seo/model/seo.store";
import BlogPostCard from "~~/features/seo/ui/BlogPostCard.vue";
import BlogSidebar from "~~/widgets/seo/BlogSidebar.vue";
import EmptyState from "~~/shared/ui/EmptyState.vue";
import { routes } from "~~/shared/constants/routes";

const route = useRoute();
const { t, locale } = useI18n();
const store = useSeoStore();
const filters = computed(() => blogQuerySchema.parse(route.query));
// Todos los posts del idioma (pocos KB de metadatos); el filtrado es en memoria (sin otra consulta)
const { data: posts } = await useAsyncData(`blog:${locale.value}`, () => queryCollection("blog").where("locale", "=", locale.value).order("date", "DESC").select("path", "title", "description", "date", "author", "category", "tags", "image", "imageAlt", "locale").all());
const all = computed(() => (posts.value ?? []) as unknown as BlogPost[]);
const visible = computed(() => all.value.filter((post) => (!filters.value.category || post.category === filters.value.category) && (!filters.value.tag || post.tags.includes(filters.value.tag))));
useSEOMeta(() => ({ title: t("blog.title"), description: t("blog.description"), path: routes.blog }));
</script>

<template>
  <div class="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_260px]">
    <section class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-3xl font-bold">{{ $t("blog.title") }}</h1>
          <p class="mt-2 text-slate-600">{{ $t("blog.description") }}</p>
        </div>
        <button type="button" class="rounded-md border px-3 py-1.5 text-sm" :aria-pressed="store.blogView === 'list'" @click="store.toggleBlogView()">{{ store.blogView === "grid" ? $t("blog.listView") : $t("blog.gridView") }}</button>
      </header>
      <EmptyState v-if="!visible.length" :title="$t('blog.empty')" />
      <ul v-else :class="store.blogView === 'grid' ? 'grid grid-cols-1 gap-6 sm:grid-cols-2' : 'flex flex-col gap-3'">
        <li v-for="post in visible" :key="post.path"><BlogPostCard :post="post" :compact="store.blogView === 'list'" /></li>
      </ul>
    </section>
    <BlogSidebar :posts="all" :active="filters" />
  </div>
</template>
