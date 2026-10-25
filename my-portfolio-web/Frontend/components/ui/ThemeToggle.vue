<!-- <template>
  <button
    @click="toggleTheme"
    :aria-label="`Switch to ${isDark ? 'light' : 'dark'} mode`"
    class="p-2 rounded text-xl transition-colors duration-300"
    :class="isDark ? 'bg-gray-800 text-white' : 'bg-yellow-300 text-black'"
  >
    <span v-if="isDark">🌙</span>
    <span v-else>☀️</span>
  </button>
</template>

<script setup lang="ts">
import { computed, useColorMode } from '#imports'

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const toggleTheme = () => {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}
</script> -->
<!-- <template>
  <button
    @click="toggleTheme"
    :aria-label="`Cambiar a modo ${isDark ? 'claro' : 'oscuro'}`"
    class="fixed bottom-4 right-4 z-50 p-3 rounded-full shadow-lg transition-colors duration-300
           bg-white text-yellow-500 dark:bg-gray-800 dark:text-yellow-300
           hover:bg-gray-100 dark:hover:bg-gray-700"
  >
    <span v-if="isDark">
    
      <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path
          d="M21.752 15.002A9.718 9.718 0 0112 21c-5.523 0-10-4.477-10-10 0-4.41 2.858-8.166 6.856-9.542a1 1 0 01.99 1.623A8 8 0 0020 14a1 1 0 011.752 1.002z"
        />
      </svg>
    </span>
    <span v-else>
  
      <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path
          d="M12 4.354a1 1 0 011-1h0a1 1 0 110 2h0a1 1 0 01-1-1zm0 14.292a1 1 0 011 1h0a1 1 0 11-2 0h0a1 1 0 011-1zm7.071-10.607a1 1 0 010 1.414h0a1 1 0 11-1.414-1.414h0a1 1 0 011.414 0zM6.343 17.657a1 1 0 011.414 0h0a1 1 0 11-1.414 1.414h0a1 1 0 010-1.414zm12.728 6.364a1 1 0 01-1.414 0h0a1 1 0 111.414-1.414h0a1 1 0 010 1.414zM4.222 5.636a1 1 0 010-1.414h0a1 1 0 011.414 1.414h0a1 1 0 01-1.414 0zM12 6a6 6 0 110 12 6 6 0 010-12z"
        />
      </svg>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed, useColorMode } from '#imports'

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const toggleTheme = () => {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}
</script> -->
<!-- 
<template>
  <button
    @click="toggleTheme"
    :aria-label="`Cambiar a modo ${isDark ? 'claro' : 'oscuro'}`"
    class="text-gray-700 dark:text-yellow-300 hover:text-yellow-500 dark:hover:text-yellow-100 transition-colors"
  >
    <svg
      v-if="isDark"
      xmlns="http://www.w3.org/2000/svg"
      class="h-6 w-6"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        d="M21.752 15.002A9.718 9.718 0 0112 21c-5.523 0-10-4.477-10-10 0-4.41 2.858-8.166 6.856-9.542a1 1 0 01.99 1.623A8 8 0 0020 14a1 1 0 011.752 1.002z"
      />
    </svg>
    <svg
      v-else
      xmlns="http://www.w3.org/2000/svg"
      class="h-6 w-6"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 4.354a1 1 0 011-1h0a1 1 0 110 2h0a1 1 0 01-1-1zm0 14.292a1 1 0 011 1h0a1 1 0 11-2 0h0a1 1 0 011-1zm7.071-10.607a1 1 0 010 1.414h0a1 1 0 11-1.414-1.414h0a1 1 0 011.414 0zM6.343 17.657a1 1 0 011.414 0h0a1 1 0 11-1.414 1.414h0a1 1 0 010-1.414zm12.728 6.364a1 1 0 01-1.414 0h0a1 1 0 111.414-1.414h0a1 1 0 010 1.414zM4.222 5.636a1 1 0 010-1.414h0a1 1 0 011.414 1.414h0a1 1 0 01-1.414 0zM12 6a6 6 0 110 12 6 6 0 010-12z"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { computed, useColorMode } from '#imports'

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const toggleTheme = () => {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}
</script> -->
<!-- <script setup lang="ts">
import { computed } from 'vue'
import { useColorMode } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

const mode   = useColorMode()
const isDark = computed(() => mode.value === 'dark')
const toggleTheme = () => { mode.value = isDark.value ? 'light' : 'dark' }

const { t } = useI18n()
</script>

<template>
  <button
    :aria-label="t('toggleTheme')"
    @click="toggleTheme"
    class="h-9 w-9 rounded-full p-[6px]                                   /* círculo */
           bg-gradient-to-br from-yellow-300 via-pink-400 to-purple-500  /* fondo arcoíris */
           dark:from-yellow-200 dark:via-pink-300 dark:to-violet-400
           bg-[length:200%_200%] animate-gradient-move                   /* animación */
           ring-2 ring-black/60 dark:ring-yellow-700/60                  /* borde oscuro / amarillo quemado */
           shadow-lg hover:shadow-yellow-300/40 dark:hover:shadow-purple-400/30
           hover:scale-110 active:scale-95 transition-all
           flex items-center justify-center text-yellow-400 dark:text-yellow-300
           hover:text-yellow-200 dark:hover:text-yellow-100"
  >
    Luna
    <svg
      v-if="isDark"
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        d="M21.752 15.002A9.718 9.718 0 0112 21a9 9 0 01-3.144-17.919 1 1 0 01.99 1.623A8 8 0 0020 14a1 1 0 011.752 1.002z"
      />
    </svg>

    Sol
    <svg
      v-else
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 4.354a1 1 0 011-1h0a1 1 0 110 2h0a1 1 0 01-1-1zm0 14.292a1 1 0 011 1h0a1 1 0 11-2 0h0a1 1 0 011-1zm7.071-10.607a1 1 0 010 1.414h0a1 1 0 11-1.414-1.414h0a1 1 0 011.414 0zM6.343 17.657a1 1 0 011.414 0h0a1 1 0 11-1.414 1.414h0a1 1 0 010-1.414zm12.728 6.364a1 1 0 01-1.414 0h0a1 1 0 111.414-1.414h0a1 1 0 010 1.414zM4.222 5.636a1 1 0 010-1.414h0a1 1 0 011.414 1.414h0a1 1 0 01-1.414 0zM12 6a6 6 0 110 12 6 6 0 010-12z"
      />
    </svg>
  </button>
</template>

<style scoped>
@keyframes gradient-move {
  0%   { background-position: 0% 50% }
  50%  { background-position: 100% 50% }
  100% { background-position: 0% 50% }
}
.animate-gradient-move { animation: gradient-move 5s linear infinite }
</style> -->

<!-- <template>
  <button
    @click="toggleTheme"
    :aria-label="`Cambiar a modo ${isDark ? 'claro' : 'oscuro'}`"
    class="text-gray-700 dark:text-yellow-300 hover:text-yellow-500 dark:hover:text-yellow-100 transition-colors"
  >
    <svg
      v-show="isDark"
      ref="moonIcon"
      xmlns="http://www.w3.org/2000/svg"
      class="h-6 w-6"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        d="M21.752 15.002A9.718 9.718 0 0112 21c-5.523 0-10-4.477-10-10 0-4.41 2.858-8.166 6.856-9.542a1 1 0 01.99 1.623A8 8 0 0020 14a1 1 0 011.752 1.002z"
      />
    </svg>
    <svg
      v-show="!isDark"
      ref="sunIcon"
      xmlns="http://www.w3.org/2000/svg"
      class="h-6 w-6"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 4.354a1 1 0 011-1h0a1 1 0 110 2h0a1 1 0 01-1-1zm0 14.292a1 1 0 011 1h0a1 1 0 11-2 0h0a1 1 0 011-1zm7.071-10.607a1 1 0 010 1.414h0a1 1 0 11-1.414-1.414h0a1 1 0 011.414 0zM6.343 17.657a1 1 0 011.414 0h0a1 1 0 11-1.414 1.414h0a1 1 0 010-1.414zm12.728 6.364a1 1 0 01-1.414 0h0a1 1 0 111.414-1.414h0a1 1 0 010 1.414zM4.222 5.636a1 1 0 010-1.414h0a1 1 0 011.414 1.414h0a1 1 0 01-1.414 0zM12 6a6 6 0 110 12 6 6 0 010-12z"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useColorMode } from '#imports'
import { gsap } from 'gsap'

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const sunIcon = ref<SVGSVGElement | null>(null)
const moonIcon = ref<SVGSVGElement | null>(null)

watch(isDark, async () => {
  await nextTick()
  animateIcon()
})

const animateIcon = () => {
  const fromIcon = isDark.value ? sunIcon.value : moonIcon.value
  const toIcon = isDark.value ? moonIcon.value : sunIcon.value

  if (!fromIcon || !toIcon) return

  gsap.timeline()
    .to(fromIcon, {
      duration: 0.3,
      rotation: 90,
      scale: 0,
      opacity: 0,
      transformOrigin: 'center center',
      ease: 'power2.inOut',
    })
    .set(fromIcon, { display: 'none' }) // Oculta después de desaparecer
    .set(toIcon, { display: 'block' })  // Muestra antes de animar
    .fromTo(
      toIcon,
      { rotation: -90, scale: 0, opacity: 0 },
      {
        duration: 0.3,
        rotation: 0,
        scale: 1,
        opacity: 1,
        transformOrigin: 'center center',
        ease: 'power2.out',
      }
    )
}

const toggleTheme = () => {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}
</script>  -->
<!-- 
<template>
  <button
    @click="toggleTheme"
    :aria-label="`Cambiar a modo ${isDark ? 'claro' : 'oscuro'}`"
    class="text-gray-700 dark:text-yellow-300 hover:text-yellow-500 dark:hover:text-yellow-100
           transition-all duration-300 ease-in-out transform hover:scale-105
           hover:glow-light dark:hover:glow-dark"
  >
    <svg
      v-show="isDark"
      ref="moonIcon"
      xmlns="http://www.w3.org/2000/svg"
      class="h-6 w-6"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        d="M21.752 15.002A9.718 9.718 0 0112 21c-5.523 0-10-4.477-10-10 0-4.41 2.858-8.166 6.856-9.542a1 1 0 01.99 1.623A8 8 0 0020 14a1 1 0 011.752 1.002z"
      />
    </svg>
    <svg
      v-show="!isDark"
      ref="sunIcon"
      xmlns="http://www.w3.org/2000/svg"
      class="h-6 w-6"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 4.354a1 1 0 011-1h0a1 1 0 110 2h0a1 1 0 01-1-1zm0 14.292a1 1 0 011 1h0a1 1 0 11-2 0h0a1 1 0 011-1zm7.071-10.607a1 1 0 010 1.414h0a1 1 0 11-1.414-1.414h0a1 1 0 011.414 0zM6.343 17.657a1 1 0 011.414 0h0a1 1 0 11-1.414 1.414h0a1 1 0 010-1.414zm12.728 6.364a1 1 0 01-1.414 0h0a1 1 0 111.414-1.414h0a1 1 0 010 1.414zM4.222 5.636a1 1 0 010-1.414h0a1 1 0 011.414 1.414h0a1 1 0 01-1.414 0zM12 6a6 6 0 110 12 6 6 0 010-12z"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useColorMode } from '#imports'
import { gsap } from 'gsap'

const colorMode = useColorMode()
const isDark = computed((): boolean => colorMode.value === 'dark')

const sunIcon = ref<SVGSVGElement | null>(null)
const moonIcon = ref<SVGSVGElement | null>(null)

watch(isDark, async () => {
  await nextTick()
  animateIcon()
})

const animateIcon = () => {
  const fromIcon = isDark.value ? sunIcon.value : moonIcon.value
  const toIcon = isDark.value ? moonIcon.value : sunIcon.value

  if (!fromIcon || !toIcon) return

  gsap.timeline()
    .to(fromIcon, {
      duration: 0.3,
      rotation: 90,
      scale: 0,
      opacity: 0,
      transformOrigin: 'center center',
      ease: 'power2.inOut',
    })
    .set(fromIcon, { display: 'none' })
    .set(toIcon, { display: 'block' })
    .fromTo(
      toIcon,
      { rotation: -90, scale: 0, opacity: 0 },
      {
        duration: 0.3,
        rotation: 0,
        scale: 1,
        opacity: 1,
        transformOrigin: 'center center',
        ease: 'power2.out',
      }
    )
}

const toggleTheme = () => {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}
</script> -->
<!-- components/ui/ThemeToggle.vue -->
<template>
  <button @click="toggleTheme" :aria-label="`Cambiar a modo ${isDark ? 'claro' : 'oscuro'}`" class="h-9 w-9 rounded-full p-1 flex items-center justify-center
           text-gray-700 dark:text-yellow-300
           hover:text-yellow-500 dark:hover:text-yellow-100
           transition-all duration-300 ease-in-out
           transform hover:scale-110                  
           hover:glow-blue-light dark:hover:glow-blue-dark">
    <!-- Luna -->
    <svg v-show="isDark" ref="moonIcon" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="currentColor"
      viewBox="0 0 24 24">
      <path
        d="M21.752 15.002A9.718 9.718 0 0112 21c-5.523 0-10-4.477-10-10 0-4.41 2.858-8.166 6.856-9.542a1 1 0 01.99 1.623A8 8 0 0020 14a1 1 0 011.752 1.002z" />
    </svg>

    <!-- Sol -->
    <svg v-show="!isDark" ref="sunIcon" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="currentColor"
      viewBox="0 0 24 24">
      <path
        d="M12 4.35a1 1 0 011-1 1 1 0 010 2 1 1 0 01-1-1zm0 14.3a1 1 0 011 1 1 1 0 01-2 0 1 1 0 011-1zm7.07-10.61a1 1 0 010 1.42 1 1 0 11-1.42-1.42 1 1 0 011.42 0zM6.34 17.66a1 1 0 011.42 0 1 1 0 11-1.42 1.42 1 1 0 010-1.42zM20.49 20.49a1 1 0 01-1.41 0 1 1 0 111.41-1.41 1 1 0 010 1.41zM4.22 5.64a1 1 0 010-1.41 1 1 0 011.41 1.41 1 1 0 01-1.41 0zM12 6a6 6 0 110 12 6 6 0 010-12z" />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useColorMode } from '#imports'
import { gsap } from 'gsap'

const colorMode = useColorMode()
const isDark = computed((): boolean => colorMode.value === 'dark')

const sunIcon = ref<SVGSVGElement | null>(null)
const moonIcon = ref<SVGSVGElement | null>(null)

/* animación giro/zoom entre iconos */
watch(isDark, async () => {
  await nextTick()
  const from = isDark.value ? sunIcon.value : moonIcon.value
  const to = isDark.value ? moonIcon.value : sunIcon.value
  if (!from || !to) return

  gsap.timeline()
    .to(from, { duration: .3, rotation: 90, scale: 0, opacity: 0, transformOrigin: 'center', ease: 'power2.inOut' })
    .set(from, { display: 'none' })
    .set(to, { display: 'block' })
    .fromTo(to,
      { rotation: -90, scale: 0, opacity: 0 },
      { duration: .3, rotation: 0, scale: 1, opacity: 1, transformOrigin: 'center', ease: 'power2.out' }
    )
})

const toggleTheme = () => {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}
</script>

<style scoped>
/* ---------- Glow helpers ---------- */
@layer utilities {
  .hover\:glow-blue-light:hover {
    text-shadow:
      0 0 6px rgba(255, 255, 255, .8),
      0 0 10px rgba(77, 158, 255, .8),
      0 0 14px rgba(77, 158, 255, .6);
  }

  .dark\:hover\:glow-blue-dark:hover {
    text-shadow:
      0 0 6px rgba(255, 255, 255, .2),
      0 0 12px rgba(154, 220, 255, .5),
      0 0 18px rgba(154, 220, 255, .4);
  }
}
</style>
