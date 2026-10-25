<!--
  [Capa: Pages — ruta "/blog". Listado de posts publicados desde el backend Nest (/posts).]
  [SEO: useSeoMeta + SSR. a11y: main landmark, headings, time.]
-->
<script setup lang="ts">
import { useAsyncData, useSeoMeta, definePageMeta } from '#imports';
import { useApi } from '~/composables/useApi';
import type { BlogPost } from '~/shared/api/contracts';

definePageMeta({ layout: 'default' });

// Solo posts publicados (el backend filtra). SSR para indexación.
const { data: posts } = await useAsyncData('blog-list', () =>
  useApi().get<BlogPost[]>('/posts'),
);

useSeoMeta({
  title: 'Blog',
  description: 'Artículos sobre arquitectura de software, IA open source, backend y más.',
  ogTitle: 'Blog — Portfolio Enterprise',
  ogType: 'website',
});

function fmtDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' });
}
</script>

<template>
  <main id="main-content" class="mx-auto max-w-4xl px-4 py-12">
    <header class="mb-10">
      <h1 class="text-3xl font-black text-gray-900 dark:text-white sm:text-4xl">Blog</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-300">
        Notas sobre arquitectura, IA open source y desarrollo full-stack.
      </p>
    </header>

    <p v-if="!posts?.length" class="text-gray-500 dark:text-gray-400">
      Aún no hay artículos publicados.
    </p>

    <ul v-else class="grid gap-6 sm:grid-cols-2">
      <li
        v-for="post in posts"
        :key="post.id"
        class="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:-translate-y-1 hover:shadow-lg dark:border-white/10 dark:bg-slate-900"
      >
        <NuxtLink :to="`/blog/${post.slug}`" class="flex h-full flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
          <!-- Portada (Cloudinary) o banner decorativo -->
          <img
            v-if="post.imageUrl"
            :src="post.imageUrl"
            :alt="post.title"
            class="h-40 w-full object-cover"
            loading="lazy"
          />
          <div v-else class="h-24 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-90 transition group-hover:opacity-100" />

          <div class="flex flex-1 flex-col p-6">
            <time v-if="post.createdAt" :datetime="post.createdAt" class="text-xs font-medium uppercase tracking-wide text-indigo-500">
              {{ fmtDate(post.createdAt) }}
            </time>
            <h2 class="mt-1 text-lg font-bold text-gray-900 transition group-hover:text-indigo-600 dark:text-white">
              {{ post.title }}
            </h2>
            <p class="mt-2 flex-1 text-sm text-gray-600 dark:text-gray-300">{{ post.excerpt }}</p>

            <div v-if="post.tags?.length" class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="tag in post.tags"
                :key="tag"
                class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300"
              >
                #{{ tag }}
              </span>
            </div>

            <div class="mt-4 flex items-center justify-end border-t border-gray-100 pt-3 dark:border-white/10">
              <span class="inline-flex items-center gap-1 text-xs font-semibold text-indigo-500">
                Leer
                <font-awesome-icon :icon="['fas', 'arrow-right']" class="transition group-hover:translate-x-1" />
              </span>
            </div>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </main>
</template>
