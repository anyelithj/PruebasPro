<!--
  [Atomic Design: Template — shell del panel admin.]
  [SRP: solo estructura (sidebar + topbar + slot). La lógica de datos vive en cada página.]
  [UX: sidebar fijo en desktop, drawer en móvil. a11y: nav landmark, aria-current, foco visible.]
  [Un solo rol ADMIN — el middleware admin ya protege estas rutas.]
-->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from '#imports';
import { useAuthStore } from '~/stores/useAuthStore';
import ThemeToggle from '~/components/ui/ThemeToggle.vue';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const open = ref(false); // drawer móvil

interface AdminLink {
  to: string;
  label: string;
  icon: string;
}
const links: AdminLink[] = [
  { to: '/admin', label: 'Dashboard', icon: 'gauge-high' },
  { to: '/admin/projects', label: 'Proyectos', icon: 'laptop-code' },
  { to: '/admin/contact', label: 'Contacto', icon: 'envelope' },
  { to: '/admin/blog', label: 'Blog', icon: 'newspaper' },
  { to: '/admin/chat', label: 'Chat IA', icon: 'robot' },
  { to: '/account', label: 'Mi perfil', icon: 'user' },
];

const initials = computed(() => {
  const name = auth.user?.name?.trim();
  if (!name) return '?';
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
});

function isActive(to: string): boolean {
  return to === '/admin' ? route.path === '/admin' : route.path.startsWith(to);
}

async function onLogout(): Promise<void> {
  await auth.logout();
  await router.push('/');
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900 dark:bg-slate-950 dark:text-gray-100">
    <!-- Backdrop móvil -->
    <div
      v-if="open"
      class="fixed inset-0 z-30 bg-black/40 md:hidden"
      @click="open = false"
    />

    <!-- Sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 dark:border-white/10 dark:bg-slate-900 md:translate-x-0"
      :class="open ? 'translate-x-0' : '-translate-x-full'"
    >
      <!-- Marca -->
      <div class="flex h-16 items-center gap-2 border-b border-gray-100 px-5 dark:border-white/10">
        <span class="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 text-white">
          <font-awesome-icon :icon="['fas', 'star']" />
        </span>
        <div class="leading-tight">
          <p class="text-sm font-black">Panel Admin</p>
          <p class="text-[11px] uppercase tracking-wide text-gray-400">Portfolio</p>
        </div>
      </div>

      <!-- Navegación -->
      <nav class="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navegación del panel">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :aria-current="isActive(link.to) ? 'page' : undefined"
          class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          :class="
            isActive(link.to)
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
          "
          @click="open = false"
        >
          <font-awesome-icon :icon="['fas', link.icon]" class="w-5 text-center" />
          {{ link.label }}
        </NuxtLink>

        <!-- Abre el sitio público en otra pestaña: el panel no se cierra, no hay que "volver". -->
        <a
          href="/"
          target="_blank"
          rel="noopener"
          class="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
        >
          <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" class="w-5 text-center" />
          Ver sitio público
          <font-awesome-icon :icon="['fas', 'up-right-from-square']" class="ml-auto text-[10px] opacity-60" />
        </a>
      </nav>

      <!-- Usuario + logout -->
      <div class="border-t border-gray-100 p-3 dark:border-white/10">
        <div class="mb-2 flex items-center gap-3 px-2">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 text-xs font-bold text-white">
            {{ initials }}
          </span>
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold">{{ auth.user?.name ?? '—' }}</p>
            <p class="truncate text-xs text-gray-400">{{ auth.user?.email ?? '' }}</p>
            <span
              v-if="auth.user?.role"
              class="mt-1 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
            >
              {{ auth.user.role }}
            </span>
          </div>
        </div>
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-500 transition hover:bg-red-50 dark:hover:bg-red-500/10"
          @click="onLogout"
        >
          <font-awesome-icon :icon="['fas', 'right-from-bracket']" class="w-5 text-center" />
          Cerrar sesión
        </button>
      </div>
    </aside>

    <!-- Columna principal -->
    <div class="md:pl-64">
      <!-- Topbar -->
      <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-gray-200 bg-white/80 px-4 backdrop-blur dark:border-white/10 dark:bg-slate-900/80">
        <button
          type="button"
          class="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden dark:text-gray-300 dark:hover:bg-white/5"
          aria-label="Abrir menú"
          :aria-expanded="open"
          @click="open = true"
        >
          <font-awesome-icon :icon="['fas', 'bars']" />
        </button>

        <div class="flex-1" />

        <span class="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">
          backend: {{ auth.provider }}
        </span>
        <ThemeToggle />
      </header>

      <main class="p-4 sm:p-6 lg:p-8">
        <slot />
      </main>
    </div>
  </div>
</template>
