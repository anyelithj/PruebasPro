<!-- [MVC-V] Perfil del admin — editable. Protegido por middleware admin. -->
<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { definePageMeta, useRouter } from '#imports';
import { useAuthStore } from '~/stores/useAuthStore';
import { useToast } from '~/composables/useToast';

definePageMeta({ middleware: 'admin', layout: 'admin' });

const auth = useAuthStore();
const router = useRouter();
const toast = useToast();

const form = reactive({ name: '', email: '' });
const editing = ref(false);

const initials = computed(() => {
  const name = auth.user?.name?.trim();
  if (!name) return '?';
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
});

const createdAt = computed(() => auth.user?.createdAt ?? auth.user?.created_at);
const updatedAt = computed(() => auth.user?.updatedAt ?? auth.user?.updated_at);

function fmt(iso?: string): string {
  return iso ? new Date(iso).toLocaleString('es') : '—';
}

// Rellena el formulario cuando llega el usuario.
watch(
  () => auth.user,
  (u) => {
    if (u) {
      form.name = u.name;
      form.email = u.email;
    }
  },
  { immediate: true },
);

onMounted(async () => {
  try {
    if (!auth.user) await auth.fetchMe();
  } catch {
    /* el middleware maneja el token inválido en la próxima navegación */
  }
});

const dirty = computed(
  () => form.name !== auth.user?.name || form.email !== auth.user?.email,
);

function cancel(): void {
  if (auth.user) {
    form.name = auth.user.name;
    form.email = auth.user.email;
  }
  editing.value = false;
}

async function save(): Promise<void> {
  if (!dirty.value) {
    editing.value = false;
    return;
  }
  try {
    await auth.updateProfile({ name: form.name.trim(), email: form.email.trim() });
    toast.success('Perfil actualizado');
    editing.value = false;
  } catch (e) {
    toast.error((e as Error).message);
  }
}

async function onLogout(): Promise<void> {
  await auth.logout();
  await router.push('/');
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-black sm:text-3xl">Mi perfil</h1>
      <button
        v-if="!editing"
        type="button"
        class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        @click="editing = true"
      >
        <font-awesome-icon :icon="['fas', 'pen']" />
        Editar
      </button>
    </div>

    <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-slate-900">
      <!-- Cabecera con avatar -->
      <div class="flex items-center gap-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-6 text-white">
        <span class="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/20 text-xl font-black backdrop-blur">
          {{ initials }}
        </span>
        <div class="min-w-0">
          <p class="truncate text-xl font-black">{{ auth.user?.name ?? 'Cargando…' }}</p>
          <p class="truncate text-sm text-white/80">{{ auth.user?.email ?? '' }}</p>
        </div>
      </div>

      <!-- Modo lectura -->
      <dl v-if="!editing" class="grid gap-px bg-gray-100 sm:grid-cols-2 dark:bg-white/10">
        <div class="bg-white p-4 dark:bg-slate-900">
          <dt class="text-xs uppercase tracking-wide text-gray-400">Rol</dt>
          <dd class="mt-1">
            <span class="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold uppercase text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
              {{ auth.user?.role ?? '—' }}
            </span>
          </dd>
        </div>
        <div class="bg-white p-4 dark:bg-slate-900">
          <dt class="text-xs uppercase tracking-wide text-gray-400">Backend activo</dt>
          <dd class="mt-1 text-sm font-semibold">{{ auth.provider }}</dd>
        </div>
        <div class="bg-white p-4 dark:bg-slate-900">
          <dt class="text-xs uppercase tracking-wide text-gray-400">Miembro desde</dt>
          <dd class="mt-1 text-sm font-semibold">{{ fmt(createdAt) }}</dd>
        </div>
        <div class="bg-white p-4 dark:bg-slate-900">
          <dt class="text-xs uppercase tracking-wide text-gray-400">Última actualización</dt>
          <dd class="mt-1 text-sm font-semibold">{{ fmt(updatedAt) }}</dd>
        </div>
        <div class="bg-white p-4 sm:col-span-2 dark:bg-slate-900">
          <dt class="text-xs uppercase tracking-wide text-gray-400">ID</dt>
          <dd class="mt-1 break-all font-mono text-xs text-gray-500 dark:text-gray-400">
            {{ auth.user?.id ?? '—' }}
          </dd>
        </div>
      </dl>

      <!-- Modo edición -->
      <form v-else class="space-y-4 p-6" @submit.prevent="save">
        <label class="block">
          <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">Nombre</span>
          <input
            v-model="form.name"
            type="text"
            required
            autocomplete="name"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-gray-600 dark:bg-slate-800 dark:text-white"
          />
        </label>
        <label class="block">
          <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">Email</span>
          <input
            v-model="form.email"
            type="email"
            required
            autocomplete="email"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-gray-600 dark:bg-slate-800 dark:text-white"
          />
        </label>
        <div class="flex gap-3">
          <button
            type="submit"
            :disabled="auth.loading || !dirty"
            class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <font-awesome-icon :icon="['fas', 'floppy-disk']" />
            {{ auth.loading ? 'Guardando…' : 'Guardar cambios' }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
            @click="cancel"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>

    <button
      type="button"
      class="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
      @click="onLogout"
    >
      <font-awesome-icon :icon="['fas', 'right-from-bracket']" />
      Cerrar sesión
    </button>
  </div>
</template>
