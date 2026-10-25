<!--
  StoreFooter.vue (widget) => pie de la tienda: navegación secundaria por columnas (landmarks <nav> con nombre),
  selector de idioma y aviso legal. Las secciones de cuenta viven en Next.js (enlaces <a>: otra aplicación).
-->
<script setup lang="ts">
import { routes } from "~~/shared/constants/routes";
import { nextAppUrl } from "~~/shared/constants/config";

const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const { locale } = useI18n();
const { storefrontUrl } = useRuntimeConfig().public;

// COLUMNS => estructura declarativa: "to" = ruta de Nuxt, "href" = página de Next.js
const COLUMNS = [
  { key: "shop", links: [{ to: routes.products, key: "allProducts" }, { to: routes.categories, key: "categories" }, { to: routes.influencers, key: "influencers" }] },
  { key: "account", links: [{ href: "/account", key: "myAccount" }, { href: "/account/orders", key: "orders" }, { href: "/account/wishlist", key: "wishlist" }, { href: "/account/loyalty", key: "loyalty" }] },
  { key: "content", links: [{ to: routes.landings, key: "promotions" }, { to: routes.blog, key: "blog" }, { to: routes.events, key: "events" }, { to: routes.lookbooks, key: "lookbooks" }] },
  // RF-21.2 ayuda y contacto (+ RF-19.9 compras en vivo)
  { key: "help", links: [{ to: routes.help, key: "helpCenter" }, { to: routes.contact, key: "contact" }, { to: routes.lives, key: "live" }] },
] as const;
</script>

<template>
  <footer class="mt-16 border-t bg-slate-50">
    <div class="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
      <nav v-for="column in COLUMNS" :key="column.key" :aria-label="$t(`store.footer.${column.key}`)">
        <h2 class="mb-3 text-sm font-semibold text-slate-900">{{ $t(`store.footer.${column.key}`) }}</h2>
        <ul class="flex flex-col gap-2 text-sm">
          <li v-for="link in column.links" :key="link.key">
            <NuxtLink v-if="'to' in link" :to="localePath(link.to)" class="text-slate-600 hover:text-slate-900 hover:underline">{{ $t(`store.footer.links.${link.key}`) }}</NuxtLink>
            <a v-else :href="nextAppUrl(storefrontUrl, locale, link.href)" class="text-slate-600 hover:text-slate-900 hover:underline">{{ $t(`store.footer.links.${link.key}`) }}</a>
          </li>
        </ul>
      </nav>
    </div>
    <div class="flex flex-col items-center justify-between gap-3 border-t px-4 py-4 text-xs text-slate-500 sm:flex-row sm:px-8">
      <p>© {{ new Date().getFullYear() }} eCommerce Web3. {{ $t("store.footer.legal") }}</p>
      <NuxtLink :to="switchLocalePath(locale === 'es' ? 'en' : 'es')" :hreflang="locale === 'es' ? 'en' : 'es'" class="hover:underline">{{ $t("store.footer.language") }}: {{ locale === "es" ? "English" : "Español" }}</NuxtLink>
    </div>
  </footer>
</template>
