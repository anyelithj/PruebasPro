<!--
  [Atomic Design: Molecule — avatar + dropdown de sesión.]
  [Hidrata el usuario desde /users/me si hay token pero el store está vacío
   (p. ej. tras recargar la página: la cookie sobrevive, el estado en memoria no).]
  [a11y: aria-expanded, cierre con Escape y con click fuera.]
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from '#imports'
import { useAuthStore } from '~/stores/useAuthStore'

const auth = useAuthStore()
const router = useRouter()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const initials = computed(() => {
  const name = auth.user?.name?.trim()
  if (!name) return '?'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
})

function close(): void {
  open.value = false
}

function onClickOutside(event: MouseEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) close()
}

function onEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') close()
}

async function onLogout(): Promise<void> {
  close()
  await auth.logout()
  await router.push('/')
}

onMounted(async () => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onEscape)

  // Token en cookie pero sin perfil en memoria → lo pide al backend activo.
  if (auth.isAuthenticated && !auth.user) {
    try {
      await auth.fetchMe()
    } catch {
      await auth.logout()
    }
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onEscape)
})
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex items-center gap-2 rounded-full p-0.5 transition hover:ring-2 hover:ring-indigo-400
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      :aria-expanded="open"
      aria-haspopup="menu"
      :aria-label="auth.user?.name ? `Menú de ${auth.user.name}` : 'Menú de cuenta'"
      @click="open = !open"
    >
      <span
        class="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500
               text-sm font-bold text-white"
      >
        {{ initials }}
      </span>
    </button>

    <transition name="menu-fade">
      <div
        v-if="open"
        role="menu"
        class="absolute right-0 z-50 mt-3 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl
               dark:border-white/10 dark:bg-slate-900"
      >
        <!-- Cabecera: avatar + nombre + email -->
        <div class="flex items-center gap-3 bg-indigo-50 px-4 py-3 dark:bg-white/5">
          <span
            class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500
                   text-sm font-bold text-white"
          >
            {{ initials }}
          </span>
          <div class="min-w-0">
            <p class="truncate text-sm font-bold text-gray-900 dark:text-white">
              {{ auth.user?.name ?? 'Cargando…' }}
            </p>
            <p class="truncate text-xs text-gray-500 dark:text-gray-400">
              {{ auth.user?.email ?? '' }}
            </p>
          </div>
        </div>

        <ul class="py-1">
          <li>
            <NuxtLink
              to="/account"
              role="menuitem"
              class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-100
                     dark:text-gray-200 dark:hover:bg-white/5"
              @click="close"
            >
              <font-awesome-icon :icon="['fas', 'user']" class="w-4 text-indigo-500" />
              Ver perfil
            </NuxtLink>
          </li>

          <template v-if="auth.user?.role === 'admin'">
            <li>
              <NuxtLink
                to="/admin"
                role="menuitem"
                class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-100
                       dark:text-gray-200 dark:hover:bg-white/5"
                @click="close"
              >
                <font-awesome-icon :icon="['fas', 'gauge-high']" class="w-4 text-indigo-500" />
                Panel admin
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/admin/contact"
                role="menuitem"
                class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-100
                       dark:text-gray-200 dark:hover:bg-white/5"
                @click="close"
              >
                <font-awesome-icon :icon="['fas', 'envelope']" class="w-4 text-indigo-500" />
                Mensajes
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/account"
                role="menuitem"
                class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-100
                       dark:text-gray-200 dark:hover:bg-white/5"
                @click="close"
              >
                <font-awesome-icon :icon="['fas', 'gear']" class="w-4 text-indigo-500" />
                Configuración
              </NuxtLink>
            </li>
          </template>
        </ul>

        <div class="border-t border-gray-200 dark:border-white/10">
          <button
            type="button"
            role="menuitem"
            class="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-500 transition
                   hover:bg-red-50 dark:hover:bg-red-500/10"
            @click="onLogout"
          >
            <font-awesome-icon :icon="['fas', 'right-from-bracket']" class="w-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (prefers-reduced-motion: reduce) {
  .menu-fade-enter-active,
  .menu-fade-leave-active {
    transition: none;
  }
}
</style>
