<!-- [MVC-V] Dashboard admin — resumen + accesos rápidos. Protegido por middleware admin. -->
<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { definePageMeta } from '#imports';
import { useAuthStore } from '~/stores/useAuthStore';
import { useProjectsAdmin } from '~/composables/useProjectsAdmin';
import { useContactAdmin } from '~/composables/useContactAdmin';

definePageMeta({ middleware: 'admin', layout: 'admin' });

const auth = useAuthStore();
const projects = useProjectsAdmin();
const contact = useContactAdmin();

// Carga en paralelo; los errores por-recurso no rompen el dashboard.
onMounted(() => {
  Promise.allSettled([projects.fetchAll(), contact.fetchAll()]);
});

const firstName = computed(() => auth.user?.name?.split(/\s+/)[0] ?? 'admin');

interface Stat {
  label: string;
  value: () => number;
  icon: string;
  to: string;
  accent: string;
}
const stats: Stat[] = [
  {
    label: 'Proyectos',
    value: () => projects.items.value.length,
    icon: 'laptop-code',
    to: '/admin/projects',
    accent: 'from-indigo-500 to-blue-500',
  },
  {
    label: 'Contactos',
    value: () => contact.total.value,
    icon: 'envelope',
    to: '/admin/contact',
    accent: 'from-purple-500 to-pink-500',
  },
  {
    label: 'Pendientes',
    value: () => contact.pending.value,
    icon: 'bell',
    to: '/admin/contact',
    accent: 'from-amber-500 to-orange-500',
  },
];
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-8">
    <!-- Saludo -->
    <header>
      <h1 class="text-2xl font-black sm:text-3xl">Hola, {{ firstName }} 👋</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Gestiona el contenido de tu portafolio desde aquí.
      </p>
    </header>

    <!-- Métricas -->
    <section aria-label="Métricas" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="s in stats"
        :key="s.label"
        :to="s.to"
        class="group rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-white/10 dark:bg-slate-900"
      >
        <div class="flex items-center justify-between">
          <span
            class="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br text-white"
            :class="s.accent"
          >
            <font-awesome-icon :icon="['fas', s.icon]" />
          </span>
          <font-awesome-icon
            :icon="['fas', 'arrow-right']"
            class="text-gray-300 transition group-hover:translate-x-1 group-hover:text-indigo-400"
          />
        </div>
        <p class="mt-4 text-3xl font-black tabular-nums">{{ s.value() }}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ s.label }}</p>
      </NuxtLink>
    </section>

    <!-- Accesos rápidos + perfil -->
    <section class="grid gap-4 lg:grid-cols-3">
      <!-- Acciones -->
      <div class="rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-2 dark:border-white/10 dark:bg-slate-900">
        <h2 class="mb-4 text-lg font-bold">Acciones rápidas</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <NuxtLink
            to="/admin/projects"
            class="flex items-center gap-3 rounded-xl border border-gray-200 p-4 transition hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-white/10 dark:hover:bg-white/5"
          >
            <font-awesome-icon :icon="['fas', 'laptop-code']" class="text-indigo-500" />
            <span class="text-sm font-semibold">Administrar proyectos</span>
          </NuxtLink>
          <NuxtLink
            to="/admin/contact"
            class="flex items-center gap-3 rounded-xl border border-gray-200 p-4 transition hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-white/10 dark:hover:bg-white/5"
          >
            <font-awesome-icon :icon="['fas', 'envelope']" class="text-purple-500" />
            <span class="text-sm font-semibold">Bandeja de contacto</span>
          </NuxtLink>
          <NuxtLink
            to="/blockchain"
            class="flex items-center gap-3 rounded-xl border border-gray-200 p-4 transition hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-white/10 dark:hover:bg-white/5"
          >
            <font-awesome-icon :icon="['fas', 'robot']" class="text-emerald-500" />
            <span class="text-sm font-semibold">Agente blockchain</span>
          </NuxtLink>
          <NuxtLink
            to="/"
            class="flex items-center gap-3 rounded-xl border border-gray-200 p-4 transition hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-white/10 dark:hover:bg-white/5"
          >
            <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" class="text-gray-500" />
            <span class="text-sm font-semibold">Ver sitio público</span>
          </NuxtLink>
        </div>
      </div>

      <!-- Perfil -->
      <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
        <h2 class="mb-4 text-lg font-bold">Tu perfil</h2>
        <dl class="space-y-3 text-sm">
          <div>
            <dt class="text-gray-400">Nombre</dt>
            <dd class="font-semibold">{{ auth.user?.name ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-gray-400">Email</dt>
            <dd class="font-semibold break-all">{{ auth.user?.email ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-gray-400">Rol</dt>
            <dd>
              <span class="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                {{ auth.user?.role ?? '—' }}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  </div>
</template>
