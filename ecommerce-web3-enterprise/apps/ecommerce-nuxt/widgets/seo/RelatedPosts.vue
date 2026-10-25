<!--
  RelatedPosts.vue (widget + Nuxt Content) => hasta 3 posts de la misma categoría e idioma (enlazado interno: mejora
  el SEO y la permanencia). Consulta SQLite local de Nuxt Content en el servidor (useAsyncData con clave estable: se
  cachea con el ISR de la página). Patrón Observer (datos reactivos) + Composite (tarjetas).
-->
<script setup lang="ts">
import type { BlogPost } from "~~/entities/blog/model/blog.types";
import BlogPostCard from "~~/features/seo/ui/BlogPostCard.vue";

const props = defineProps<{ post: BlogPost }>();
const { data: related } = await useAsyncData(`related:${props.post.path}`, () =>
  queryCollection("blog").where("category", "=", props.post.category).where("locale", "=", props.post.locale).where("path", "<>", props.post.path).order("date", "DESC").limit(3).all()
);
</script>

<template>
  <section v-if="related?.length" aria-labelledby="related-title" class="flex flex-col gap-4">
    <h2 id="related-title" class="text-xl font-semibold">{{ $t("blog.related") }}</h2>
    <ul class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <li v-for="item in related" :key="item.path"><BlogPostCard :post="item as unknown as BlogPost" compact /></li>
    </ul>
  </section>
</template>
