<!--
  page.vue (/blog/[slug]) => entrada del blog (Nuxt Content, SSR + ISR 24 h): contenido MDC, JSON-LD BlogPosting,
  migas de pan y posts relacionados (enlazado interno). Slug validado con Zod (404 temprano).
-->
<script setup lang="ts">
import type { BlogPost } from "~~/entities/blog/model/blog.types";
import { useSEOMeta } from "~~/features/seo/composable/useSEOMeta";
import { slugParam } from "~~/features/seo/lib/seo.validator";
import BlogPostContent from "~~/features/seo/ui/BlogPostContent.vue";
import SchemaOrgMeta from "~~/features/seo/ui/SchemaOrgMeta.vue";
import BreadcrumbNav from "~~/widgets/navigation/BreadcrumbNav.vue";
import RelatedPosts from "~~/widgets/seo/RelatedPosts.vue";
import { routes } from "~~/shared/constants/routes";

const route = useRoute();
const slug = slugParam.safeParse(route.params["slug"]);
if (!slug.success) throw createError({ statusCode: 404, fatal: true });
const { data: post } = await useAsyncData(`post:${slug.data}`, () => queryCollection("blog").path(`/blog/${slug.data}`).first());
if (!post.value) throw createError({ statusCode: 404, fatal: true });
const article = computed(() => post.value as unknown as BlogPost & { body: unknown });
const { t } = useI18n();
const { public: config } = useRuntimeConfig();
useSEOMeta(() => ({ title: article.value.title, description: article.value.description, image: article.value.image, type: "article", path: routes.blogPost(slug.data) }));
</script>

<template>
  <div class="flex flex-col gap-10">
    <SchemaOrgMeta type="BlogPosting" :data="{ title: article.title, description: article.description, date: article.date, author: article.author, image: article.image, url: `${config.siteUrl}/blog/${slug.data}` }" />
    <BreadcrumbNav :items="[{ label: t('blog.title'), to: routes.blog }, { label: article.title }]" />
    <BlogPostContent :post="article" />
    <RelatedPosts :post="article" />
  </div>
</template>
