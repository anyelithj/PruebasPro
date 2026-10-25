<!--
  BlogPostCard.vue (Vue 3) => tarjeta de entrada del blog: imagen, categoría, título, extracto, fecha y autor.
  Patrón Factory (post -> tarjeta). <article> con <time datetime> (semántica para buscadores y lectores de pantalla);
  toda la tarjeta es un enlace con el título como nombre accesible. Imagen lazy con dimensiones (sin CLS).
-->
<script setup lang="ts">
import type { BlogPost } from "~~/entities/blog/model/blog.types";
import { formatDate } from "~~/shared/lib/format";

withDefaults(defineProps<{ post: BlogPost; compact?: boolean }>(), { compact: false });
const { locale } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <article class="group overflow-hidden rounded-xl border bg-white">
    <NuxtLink :to="localePath(post.path)" class="flex h-full flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <img v-if="post.image && !compact" :src="post.image" :alt="post.imageAlt ?? ''" loading="lazy" width="640" height="360" class="aspect-video w-full object-cover" >
      <div class="flex flex-1 flex-col gap-2 p-4">
        <p class="text-xs font-medium uppercase tracking-wide text-accent">{{ post.category }}</p>
        <h2 :class="['font-semibold group-hover:underline', compact ? 'text-sm' : 'text-lg']">{{ post.title }}</h2>
        <p v-if="!compact" class="line-clamp-3 text-sm text-slate-600">{{ post.description }}</p>
        <p class="mt-auto text-xs text-slate-500">
          <time :datetime="post.date">{{ formatDate(post.date, locale) }}</time> · {{ post.author }}
        </p>
      </div>
    </NuxtLink>
  </article>
</template>
