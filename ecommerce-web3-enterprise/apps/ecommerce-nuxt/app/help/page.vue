<!--
  page.vue (/help) => RF-21.2 centro de ayuda: preguntas frecuentes por categoría con buscador, datos de contacto
  (correo, WhatsApp y horario) y acceso al formulario de contacto y al chat. SSR + ISR (petición anónima).
  SEO: JSON-LD FAQPage (Google muestra las preguntas en los resultados). Accesibilidad: <details>/<summary> nativos
  (teclado y lector de pantalla sin JavaScript), búsqueda con <label>, resultados anunciados con aria-live.
-->
<script setup lang="ts">
import { computed, ref } from "vue";
import { useApi } from "~~/shared/lib/api-client";
import { routes } from "~~/shared/constants/routes";
import { searchFaq, type HelpConfig } from "~~/features/store/lib/help.validator";

const { t } = useI18n();
const localePath = useLocalePath();
const api = useApi({ anonymous: true });
// /cms/config sin sesión => solo la configuración pública (incluye "help")
const { data: help } = await useAsyncData("store-help", async () => (await api.get<{ help: HelpConfig | null }>("/cms/config")).data.help ?? null);
const query = ref("");
const groups = computed(() => searchFaq(help.value?.faq ?? [], query.value));
const total = computed(() => groups.value.reduce((sum, group) => sum + group.items.length, 0));

useSeoMeta({ title: () => t("store.help.title"), description: () => t("store.help.metaDescription") });
useHead({
  script: [{ type: "application/ld+json", innerHTML: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: (help.value?.faq ?? []).map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) }) }],
});
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-8">
    <header class="flex flex-col gap-3">
      <h1 class="text-3xl font-semibold">{{ $t("store.help.title") }}</h1>
      <p class="text-slate-600">{{ $t("store.help.subtitle") }}</p>
      <label class="flex flex-col gap-1 text-sm font-medium">{{ $t("store.help.search") }}
        <input v-model="query" type="search" :placeholder="$t('store.help.searchPlaceholder')" class="h-9 rounded-md border px-3 font-normal" >
      </label>
      <p aria-live="polite" class="text-xs text-slate-500">{{ query ? $t("store.help.results", { n: total }) : "" }}</p>
    </header>

    <section v-for="group in groups" :key="group.category" :aria-labelledby="`faq-${group.category}`" class="flex flex-col gap-2">
      <h2 :id="`faq-${group.category}`" class="text-lg font-semibold">{{ group.category }}</h2>
      <details v-for="item in group.items" :key="item.question" class="rounded-lg border p-4 open:bg-slate-50">
        <summary class="cursor-pointer font-medium">{{ item.question }}</summary>
        <p class="mt-2 whitespace-pre-line text-sm text-slate-700">{{ item.answer }}</p>
      </details>
    </section>
    <p v-if="!total" class="text-sm text-slate-600">{{ $t("store.help.empty") }}</p>

    <aside :aria-label="$t('store.help.contactTitle')" class="flex flex-col gap-3 rounded-xl bg-slate-100 p-6">
      <h2 class="text-lg font-semibold">{{ $t("store.help.contactTitle") }}</h2>
      <ul class="flex flex-col gap-1 text-sm">
        <li v-if="help?.contactEmail">✉ <a :href="`mailto:${help.contactEmail}`" class="underline">{{ help.contactEmail }}</a></li>
        <li v-if="help?.whatsapp">💬 <a :href="`https://wa.me/${help.whatsapp.replace(/\D/g, '')}`" target="_blank" rel="noopener" class="underline">WhatsApp {{ help.whatsapp }}</a></li>
        <li v-if="help?.hours">🕘 {{ help.hours }}</li>
      </ul>
      <NuxtLink :to="localePath(routes.contact)" class="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50">{{ $t("store.help.writeUs") }}</NuxtLink>
    </aside>
  </div>
</template>
