<!--
  [Capa: Pages — "/blog/[slug]". Detalle de post desde el backend Nest (/posts/slug/:slug).]
  [Markdown → HTML con marked. Contenido lo escribe el admin (confiable) → v-html aceptable.]
  [SEO: useSeoMeta por post + SSR. a11y: article + time.]
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useAsyncData, useRoute, useSeoMeta, useHead, createError, definePageMeta } from '#imports';
import { marked } from 'marked';
import { useApi } from '~/composables/useApi';
import type { BlogPost } from '~/shared/api/contracts';

definePageMeta({ layout: 'default' });

const route = useRoute();
const slug = String(route.params.slug);

const { data: post } = await useAsyncData(`blog-${slug}`, () =>
  useApi().get<BlogPost>(`/posts/slug/${slug}`).catch(() => null),
);

if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: 'Artículo no encontrado' });
}

const contentHtml = computed(() => marked.parse(post.value?.content ?? '') as string);

useSeoMeta({
  title: () => post.value?.title,
  description: () => post.value?.excerpt,
  ogTitle: () => post.value?.title,
  ogDescription: () => post.value?.excerpt,
  ogType: 'article',
  ogImage: () => post.value?.imageUrl ?? undefined,
  twitterCard: 'summary_large_image',
});

useHead({
  link: [{ rel: 'canonical', href: `https://juanperez.dev/blog/${slug}` }],
});

function fmtDate(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
}
</script>

<template>
  <main id="main-content" class="mx-auto max-w-3xl px-4 py-12">
    <NuxtLink
      to="/blog"
      class="inline-flex items-center gap-2 text-sm font-medium text-indigo-500 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      <font-awesome-icon :icon="['fas', 'arrow-left']" />
      Volver al blog
    </NuxtLink>

    <article v-if="post" class="mt-6">
      <img
        v-if="post.imageUrl"
        :src="post.imageUrl"
        :alt="post.title"
        class="mb-6 h-56 w-full rounded-2xl object-cover sm:h-72"
      />
      <header class="mb-8 border-b border-gray-200 pb-6 dark:border-white/10">
        <time v-if="post.createdAt" :datetime="post.createdAt" class="text-xs font-medium uppercase tracking-wide text-indigo-500">
          {{ fmtDate(post.createdAt) }}
        </time>
        <h1 class="mt-2 text-3xl font-black text-gray-900 dark:text-white sm:text-4xl">
          {{ post.title }}
        </h1>
        <p v-if="post.excerpt" class="mt-3 text-lg text-gray-600 dark:text-gray-300">
          {{ post.excerpt }}
        </p>
        <div v-if="post.tags?.length" class="mt-4 flex flex-wrap gap-2">
          <span
            v-for="tag in post.tags"
            :key="tag"
            class="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
          >
            #{{ tag }}
          </span>
        </div>
      </header>

      <!-- Contenido Markdown renderizado -->
      <div class="post-body" v-html="contentHtml" />
    </article>
  </main>
</template>

<style scoped>
.post-body :deep(h1),
.post-body :deep(h2),
.post-body :deep(h3) {
  font-weight: 800;
  line-height: 1.25;
  margin: 1.8rem 0 0.8rem;
  color: rgb(17 24 39);
}
:global(.dark) .post-body :deep(h1),
:global(.dark) .post-body :deep(h2),
:global(.dark) .post-body :deep(h3) {
  color: rgb(243 244 246);
}
.post-body :deep(h1) { font-size: 1.8rem; }
.post-body :deep(h2) { font-size: 1.4rem; }
.post-body :deep(h3) { font-size: 1.15rem; }
.post-body :deep(p) {
  margin: 1rem 0;
  line-height: 1.75;
  color: rgb(55 65 81);
}
:global(.dark) .post-body :deep(p) { color: rgb(209 213 219); }
.post-body :deep(ul),
.post-body :deep(ol) {
  margin: 1rem 0;
  padding-left: 1.5rem;
}
.post-body :deep(ul) { list-style: disc; }
.post-body :deep(ol) { list-style: decimal; }
.post-body :deep(li) { margin: 0.35rem 0; }
.post-body :deep(a) {
  color: rgb(99 102 241);
  text-decoration: underline;
}
.post-body :deep(pre) {
  margin: 1.25rem 0;
  padding: 1rem;
  border-radius: 0.75rem;
  overflow-x: auto;
  font-size: 0.85rem;
  background: rgb(243 244 246);
}
:global(.dark) .post-body :deep(pre) { background: rgb(15 23 42); }
.post-body :deep(code) {
  font-family: ui-monospace, monospace;
  font-size: 0.85em;
}
.post-body :deep(:not(pre) > code) {
  padding: 0.15rem 0.4rem;
  border-radius: 0.35rem;
  background: rgb(243 244 246);
}
:global(.dark) .post-body :deep(:not(pre) > code) { background: rgb(30 41 59); }
.post-body :deep(blockquote) {
  margin: 1.25rem 0;
  padding-left: 1rem;
  border-left: 3px solid rgb(129 140 248);
  color: rgb(107 114 128);
}
.post-body :deep(table) {
  width: 100%;
  margin: 1.25rem 0;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.post-body :deep(th),
.post-body :deep(td) {
  border: 1px solid rgb(209 213 219);
  padding: 0.5rem 0.75rem;
  text-align: left;
}
:global(.dark) .post-body :deep(th),
:global(.dark) .post-body :deep(td) {
  border-color: rgb(51 65 85);
}
</style>
