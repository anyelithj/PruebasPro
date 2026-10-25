<!--
  StoreHeader.vue (widget) => cabecera de la tienda: logo, buscador (GET /products?q=: funciona sin JavaScript),
  secciones de contenido, idioma, carrito con contador y cuenta (login/registro o el MISMO menú de usuario del panel). Debajo, menú de
  categorías con <details> nativo (desplegable accesible por teclado sin JS). Sticky: carrito y búsqueda siempre a mano.
-->
<script setup lang="ts">
import { onMounted } from "vue";
import type { CategoryNode } from "~~/entities/blog/model/blog.types";
import { useCartStore } from "~~/features/cart/model/cart.store";
import { useAuth } from "~~/shared/composable/useAuth";
import { routes } from "~~/shared/constants/routes";
import { nextAppUrl, storeLoginUrl } from "~~/shared/constants/config";
import UserMenu from "./UserMenu.vue"; // Mismo menú de usuario que el panel (Next y Nuxt)
import ThemeToggle from "~~/shared/ui/ThemeToggle.vue";
import StoreSearch from "~~/features/search/ui/StoreSearch.vue"; // RF-06.1/06.2 autocompletado, voz, QR e imagen
import { captureAttribution } from "~~/features/cart/model/attribution";

defineProps<{ categories: CategoryNode[] }>();
const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const { locale } = useI18n();
const { user, isAuthenticated } = useAuth();
const cart = useCartStore();
const { storefrontUrl } = useRuntimeConfig().public;
const next = (path: string) => nextAppUrl(storefrontUrl, locale.value, path);

// LINKS => secciones de contenido (Composite: agregar una sección = agregar una fila)
const LINKS = [
  { to: routes.landings, key: "nav.landings" },
  { to: routes.lookbooks, key: "nav.lookbooks" },
  { to: routes.collections, key: "nav.collections" },
  { to: routes.categories, key: "nav.categories" },
  { to: routes.events, key: "nav.events" },
  { to: routes.blog, key: "nav.blog" },
] as const;

onMounted(() => cart.load());
captureAttribution(useRoute().query); // RF-09.7 canal de origen (utm / enlaces de Social Commerce) // Contador del carrito: solo en el navegador (dato privado, nunca en caché compartida)
</script>

<template>
  <header class="sticky top-0 z-30 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
    <div class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
      <NuxtLink :to="localePath(routes.home)" class="shrink-0 text-lg font-bold text-slate-900">eCommerce Web3</NuxtLink>
      <div class="mx-auto hidden w-full max-w-md md:block"><StoreSearch id="store-search" /></div>
      <div class="ml-auto flex items-center gap-1 text-sm">
        <NuxtLink :to="switchLocalePath(locale === 'es' ? 'en' : 'es')" class="rounded-md px-2 py-2 text-slate-600 hover:bg-slate-100" :hreflang="locale === 'es' ? 'en' : 'es'">{{ locale === "es" ? "EN" : "ES" }}</NuxtLink>
        <ThemeToggle />
        <button v-if="isAuthenticated" type="button" :aria-label="$t('store.cart.badge', { count: cart.count })" aria-haspopup="dialog" class="relative flex size-10 items-center justify-center rounded-md hover:bg-slate-100" @click="cart.isOpen = true">
          <span aria-hidden="true" class="text-xl">🛒</span>
          <span v-if="cart.count > 0" aria-hidden="true" class="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">{{ cart.count > 99 ? "99+" : cart.count }}</span>
        </button>
        <a v-else :href="storeLoginUrl(storefrontUrl, locale)" :aria-label="$t('store.cart.badge', { count: 0 })" class="flex size-10 items-center justify-center rounded-md hover:bg-slate-100"><span aria-hidden="true" class="text-xl">🛒</span></a>
        <!-- Menú de usuario ÚNICO: el mismo componente del panel (espejo del DropdownMenu de Next) -->
        <UserMenu v-if="isAuthenticated && user" />
        <template v-else>
          <a :href="storeLoginUrl(storefrontUrl, locale)" class="rounded-md px-3 py-2 text-slate-900 hover:bg-slate-100">{{ $t("nav.signIn") }}</a>
          <a :href="next('/register')" class="rounded-md bg-slate-900 px-3 py-2 font-medium text-slate-50 hover:bg-slate-700">{{ $t("nav.register") }}</a>
        </template>
      </div>
    </div>
    <div class="px-4 pb-3 md:hidden"><StoreSearch id="store-search-mobile" compact /></div>
    <nav :aria-label="$t('nav.main')" class="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 pb-2 text-sm">
      <template v-for="category in categories" :key="category.id">
        <details v-if="category.children.length" class="group relative shrink-0">
          <summary class="flex cursor-pointer list-none items-center gap-1 rounded-md px-3 py-2 font-medium text-slate-700 hover:bg-slate-100">{{ category.name }} <span aria-hidden="true" class="transition-transform group-open:rotate-180">▾</span></summary>
          <div class="absolute left-0 z-40 mt-2 min-w-56 rounded-md border bg-white p-3 shadow-lg">
            <NuxtLink :to="localePath(routes.category(category.slug))" class="mb-2 block font-semibold hover:underline">{{ $t("store.nav.viewAll", { name: category.name }) }}</NuxtLink>
            <NuxtLink v-for="child in category.children" :key="child.id" :to="localePath(routes.category(child.slug))" class="block rounded px-2 py-1 text-slate-700 hover:bg-slate-50">{{ child.name }}</NuxtLink>
          </div>
        </details>
        <NuxtLink v-else :to="localePath(routes.category(category.slug))" class="shrink-0 rounded-md px-3 py-2 font-medium text-slate-700 hover:bg-slate-100">{{ category.name }}</NuxtLink>
      </template>
      <span aria-hidden="true" class="mx-2 h-5 w-px shrink-0 bg-slate-200" />
      <NuxtLink v-for="link in LINKS" :key="link.to" :to="localePath(link.to)" class="shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" active-class="bg-slate-100 font-medium text-slate-900">{{ $t(link.key) }}</NuxtLink>
    </nav>
  </header>
</template>
