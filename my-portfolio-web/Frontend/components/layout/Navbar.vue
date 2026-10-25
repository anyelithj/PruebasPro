<template>
  <nav
    ref="navBar"
    class="fixed top-0 left-0 z-50 w-full bg-slate-900 shadow
           transition-transform duration-300"
    role="navigation"
    aria-label="Main navigation"
  >
    <!-- ───────── DESKTOP BAR ───────── -->
    <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
      <!-- Logo -->
      <client-only>
        <NuxtLink
          to="/"
          aria-label="Inicio"
          ref="logoEl"
          class="flex items-center gap-2 text-3xl font-motion font-black tracking-tight text-transparent
                 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text
                 bg-[length:200%_200%] animate-gradient-move
                 transition-transform duration-500 hover:scale-105
                 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
        >
          <font-awesome-icon :icon="['fas', 'star']" spin />
          {{ t('portfolioTitle') }}
        </NuxtLink>
      </client-only>

      <!-- Links + idioma + tema (desktop) -->
      <div class="hidden md:flex items-center gap-6">
        <ul class="flex gap-5 text-lg font-semibold">
          <li v-for="item in nav" :key="item.to">
            <NuxtLink
              :to="item.to"
              :class="[linkBase, isActive(item) && linkActive]"
              :aria-current="isActive(item) ? 'page' : undefined"
              class="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
            >
              {{ t(item.label) }}
            </NuxtLink>
          </li>
        </ul>

        <!-- Idioma — custom listbox con bandera SVG (FlagIcon en LangSelect). -->
        <LangSelect v-model="locale" :options="langs" variant="desktop" />

        <ThemeToggle />

        <!-- [CV] descarga directa; URL configurable (NUXT_PUBLIC_CV_URL). -->
        <a
          :href="cvUrl"
          download
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-3 py-1 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          <font-awesome-icon :icon="['fas', 'download']" />
          CV
        </a>

        <!-- [AUTH] sin sesión → botón entrar; con sesión → botón Panel (admin) + avatar. -->
        <client-only>
          <NuxtLink
            v-if="!auth.isAuthenticated"
            to="/login"
            class="rounded-lg border border-white/25 px-3 py-1 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            {{ t('nav.login') }}
          </NuxtLink>
          <template v-else>
            <NuxtLink
              v-if="auth.user?.role === 'admin'"
              to="/admin"
              class="rounded-lg bg-white/10 px-3 py-1 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              {{ t('nav.admin') }}
            </NuxtLink>
            <UserMenu />
          </template>
        </client-only>
      </div>

      <!-- Botón hamburguesa -->
      <button
        class="md:hidden text-white transition-transform duration-300 hover:scale-110 active:scale-90
               focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
        @click="toggleMenu"
        aria-label="Toggle menu"
        :aria-expanded="isOpen"
      >
        <font-awesome-icon
          :icon="isOpen ? ['fas', 'times'] : ['fas', 'bars']"
          size="lg"
          :class="isOpen ? 'rotate-90' : ''"
          class="transition-transform duration-300"
        />
      </button>
    </div>

    <!-- ───────── MOBILE OVERLAY ───────── -->
    <transition name="fade-slide">
      <div
        v-if="isOpen"
        id="mobile-menu"
        class="fixed inset-0 z-50 flex flex-col
               bg-gradient-to-b from-[#0f172a] via-[#0d1a29] to-[#07111d] backdrop-blur-sm md:hidden"
      >
        <!-- Top bar móvil -->
        <div class="flex items-center justify-between px-4 pt-4">
          <NuxtLink
            to="/"
            aria-label="Inicio"
            @click="closeMenu"
            class="flex items-center gap-2 text-3xl font-motion font-black tracking-tight text-transparent
                   bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text
                   bg-[length:200%_200%] animate-gradient-move
                   transition-transform duration-500 hover:scale-105
                   focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
          >
            <font-awesome-icon :icon="['fas', 'star']" spin />
            {{ t('portfolioTitle') }}
          </NuxtLink>

          <button
            class="text-white transition-transform duration-300 hover:scale-110
                   focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
            @click="toggleMenu"
            aria-label="Close menu"
          >
            <font-awesome-icon :icon="['fas', 'times']" size="xl" />
          </button>
        </div>

        <!-- Controles móviles -->
        <div class="flex items-center gap-3 px-4 mt-6">
          <LangSelect v-model="locale" :options="langs" variant="mobile" />
          <ThemeToggle />
          <a
            :href="cvUrl"
            download
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-3 py-1 text-sm font-semibold text-white transition hover:bg-white/10"
            @click="closeMenu"
          >
            <font-awesome-icon :icon="['fas', 'download']" />
            CV
          </a>
        </div>

        <!-- Enlaces móviles -->
        <ul class="flex-grow flex flex-col items-center justify-center gap-10 text-4xl font-semibold mt-8">
          <li v-for="item in nav" :key="'mobile-' + item.to" @click="closeMenu">
            <NuxtLink
              :to="item.to"
              :class="[mobileLink, isActive(item) && linkActive]"
              :aria-current="isActive(item) ? 'page' : undefined"
              class="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
            >
              {{ t(item.label) }}
            </NuxtLink>
          </li>

          <!-- [AUTH] móvil -->
          <client-only>
            <li v-if="!auth.isAuthenticated" @click="closeMenu">
              <NuxtLink to="/login" :class="mobileLink">{{ t('nav.login') }}</NuxtLink>
            </li>
            <template v-else>
              <li v-if="auth.user?.role === 'admin'" @click="closeMenu">
                <NuxtLink to="/admin" :class="mobileLink">{{ t('nav.admin') }}</NuxtLink>
              </li>
              <li @click="closeMenu">
                <NuxtLink to="/account" :class="mobileLink">{{ t('nav.account') }}</NuxtLink>
              </li>
              <li>
                <button type="button" :class="mobileLink" @click="onLogout">
                  {{ t('nav.logout') }}
                </button>
              </li>
            </template>
          </client-only>
        </ul>
      </div>
    </transition>
  </nav>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted } from 'vue'
import { useI18n, useNuxtApp, useRoute, useRouter, useRuntimeConfig } from '#imports'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import LangSelect from '@/components/molecules/LangSelect.vue'
import UserMenu from '@/components/molecules/UserMenu.vue'
import { useAuthStore } from '~/stores/useAuthStore'

export default defineComponent({
  name: 'Navbar',
  components: { ThemeToggle, LangSelect, UserMenu },
  setup () {
    const { t, locale } = useI18n({ useScope: 'global' })
    const route         = useRoute()
    const router        = useRouter()
    const { $gsap }     = useNuxtApp()
    const auth          = useAuthStore()
    const cvUrl         = useRuntimeConfig().public.cvUrl as string

    // [AUTH] cierra sesión y vuelve al inicio.
    const onLogout = async () => {
      await auth.logout()
      isOpen.value = false
      await router.push('/')
    }

    const nav = [
      { to: '/', hash: '', label: 'nav.home' },
      { to: '#about', hash: '#about', label: 'nav.about' },
      { to: '#projects', hash: '#projects', label: 'nav.projects' },
      { to: '/blockchain', hash: '', label: 'nav.blockchain' },
      { to: '/blog', hash: '', label: 'nav.blog' },
      { to: '#contact', hash: '#contact', label: 'nav.contact' }
    ]
    // [Opciones de idioma. LangSelect renderiza la bandera con FlagIcon (SVG inline).]
    const langs = [
      { code: 'es', name: 'Español'  },
      { code: 'en', name: 'English'  },
      { code: 'fr', name: 'Français' },
      { code: 'de', name: 'Deutsch'  },
      { code: 'pt', name: 'Português'}
    ]

    const isOpen     = ref(false)
    const toggleMenu = () => { isOpen.value = !isOpen.value }
    const closeMenu  = () => { isOpen.value = false }

    const logoEl = ref<HTMLElement | null>(null)

    /* Logo intro */
    onMounted(() => {
      if (logoEl.value) {
        $gsap.fromTo(
          logoEl.value,
          { scale: 0.8, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.8, ease: 'power2.out' }
        )
      }
      /* Cerrar overlay si el usuario sigue haciendo scroll */
      window.addEventListener('scroll', closeMenu, { passive: true })
    })
    onUnmounted(() => window.removeEventListener('scroll', closeMenu))

    const isActive = (item:{to:string,hash:string}) =>
      item.to.startsWith('#')
        ? route.hash === item.hash
        : route.path === item.to && !route.hash

    /* classes tailwind reusables */
    // [linkBase — desktop sobre nav azul oscuro: texto blanco.]
    const linkBase =
      'text-white transition-all duration-300 ' +
      'hover:text-transparent hover:bg-clip-text ' +
      'hover:bg-gradient-to-r hover:from-pink-400 hover:to-yellow-400'
    // [mobileLink — para overlay mobile (fondo oscuro): texto blanco.]
    const mobileLink =
      'text-white transition-all duration-300 ' +
      'hover:text-transparent hover:bg-clip-text ' +
      'hover:bg-gradient-to-r hover:from-pink-400 hover:to-yellow-400'
    const linkActive =
      'text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-yellow-400'

    return {
      t,
      locale,
      nav,
      langs,
      isOpen,
      toggleMenu,
      closeMenu,
      isActive,
      linkBase,
      mobileLink,
      linkActive,
      logoEl,
      auth,
      cvUrl,
      onLogout
    }
  }
})
</script>

<style scoped>
@keyframes gradient-move{
  0%{background-position:0% 50%}
  50%{background-position:100% 50%}
  100%{background-position:0% 50%}
}
.animate-gradient-move{animation:gradient-move 6s ease infinite}

.fade-slide-enter-active,
.fade-slide-leave-active{transition:all .4s ease}
.fade-slide-enter-from{opacity:0;transform:translateY(-10px)}
.fade-slide-enter-to{opacity:1;transform:translateY(0)}
</style>

<style>
:root{ --navbar-h: 4.25rem }
html{
  scroll-padding-top: var(--navbar-h);
  scroll-behavior: smooth;
}
</style>
