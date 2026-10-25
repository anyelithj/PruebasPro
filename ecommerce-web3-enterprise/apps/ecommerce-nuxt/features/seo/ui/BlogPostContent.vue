<!--
  BlogPostContent.vue (Nuxt Content v3) => cuerpo del post en Markdown/MDC renderizado en el servidor (ContentRenderer):
  HTML estático listo para indexar, sin JavaScript de Markdown en el navegador. Estilos tipográficos con selectores
  de Tailwind (sin el plugin typography: menos CSS). Patrón Composite (árbol MDC -> componentes).
-->
<script setup lang="ts">
import type { BlogPost } from "~~/entities/blog/model/blog.types";
import { formatDate } from "~~/shared/lib/format";

// "body" => AST de Nuxt Content (tipo propio del módulo); se recibe el documento completo
defineProps<{ post: BlogPost & { body: unknown } }>();
const { locale } = useI18n();
</script>

<template>
  <article class="mx-auto flex max-w-3xl flex-col gap-6">
    <header class="flex flex-col gap-3">
      <p class="text-sm font-medium uppercase tracking-wide text-accent">{{ post.category }}</p>
      <h1 class="text-3xl font-bold leading-tight sm:text-4xl">{{ post.title }}</h1>
      <p class="text-lg text-slate-600">{{ post.description }}</p>
      <p class="text-sm text-slate-500"><time :datetime="post.date">{{ formatDate(post.date, locale) }}</time> · {{ post.author }}</p>
      <img v-if="post.image" :src="post.image" :alt="post.imageAlt ?? ''" width="1200" height="630" fetchpriority="high" class="aspect-[1200/630] w-full rounded-xl object-cover" >
    </header>
    <ContentRenderer :value="post as never" class="blog-body text-base leading-7 text-slate-800 [&_a]:text-accent [&_a]:underline [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:ml-6 [&_ol]:list-decimal [&_p]:mt-4 [&_ul]:list-disc" />
    <ul v-if="post.tags.length" class="flex flex-wrap gap-2" :aria-label="$t('blog.tags')">
      <li v-for="tag in post.tags" :key="tag" class="rounded-full bg-slate-100 px-3 py-1 text-xs">#{{ tag }}</li>
    </ul>
  </article>
</template>
