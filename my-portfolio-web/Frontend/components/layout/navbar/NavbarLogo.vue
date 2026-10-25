<!-- <template>
  <NuxtLink
    to="/"
    aria-label="Inicio"
    ref="logo"
    class="flex items-center gap-2 text-3xl font-motion font-black tracking-tight text-transparent
           bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text
           dark:from-pink-400 dark:via-purple-400 dark:to-blue-400
           bg-[length:200%_200%] animate-gradient-move
           transition-transform duration-500 hover:scale-105
           focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
  >
    <font-awesome-icon :icon="['fas', 'star']" spin />
    {{ title }}
  </NuxtLink>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGSAP }        from '#imports'

defineProps<{ title: string }>()

const logo = ref<HTMLElement>()

onMounted(() => {
  const gsap = useGSAP()
  if (logo.value)
    gsap.fromTo(
      logo.value,
      { scale: 0.8, opacity: 0 },
      { scale: 1,   opacity: 1, duration: 0.8, ease: 'power2.out' }
    )
})
</script>

<style scoped>
@keyframes gradient-move{
  0%  {background-position:0% 50%}
  50% {background-position:100% 50%}
  100%{background-position:0% 50%}
}
.animate-gradient-move{ animation:gradient-move 6s ease infinite }
</style> -->
<template>
  <NuxtLink
    to="/"
    aria-label="Inicio"
    @click="$emit('closeMenu')"
    class="flex items-center gap-2 text-3xl font-motion font-black tracking-tight text-transparent
           bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text
           dark:from-pink-400 dark:via-purple-400 dark:to-blue-400
           bg-[length:200%_200%] animate-gradient-move
           transition-transform duration-500 hover:scale-105
           focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
  >
    <font-awesome-icon :icon="['fas', 'star']" spin />
    {{ t('portfolioTitle') }}
  </NuxtLink>
</template>

<script setup lang="ts">
const emit = defineEmits<['closeMenu']>()
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>