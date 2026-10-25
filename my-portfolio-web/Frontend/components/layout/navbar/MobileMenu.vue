<!-- <template>
  <div
    class="fixed inset-0 z-50 flex flex-col
           bg-gradient-to-b from-[#0f172a] via-[#0d1a29] to-[#07111d] backdrop-blur-sm md:hidden"
    role="dialog" aria-modal="true"
  >

    <div class="flex items-center justify-between px-4 pt-4">
      <NavbarLogo :title="$t('portfolioTitle')" @click="emitClose" />

      <button
        class="text-white transition-transform duration-300 hover:scale-110
               focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
        aria-label="Cerrar menú"
        @click="emitClose"
      >
        <font-awesome-icon :icon="['fas', 'times']" size="xl" />
      </button>
    </div>

   
    <div class="flex items-center gap-3 px-4 mt-6">
      <select
        :value="locale"
        @change="$emit('update:locale', ($event.target as HTMLSelectElement).value)"
        class="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-2 text-base text-white
               focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
      >
        <option v-for="l in langs" :key="l.code" :value="l.code">
          {{ l.flag }} {{ l.name }}
        </option>
      </select>
      <ThemeToggle />
    </div>


    <ul class="flex-grow flex flex-col items-center justify-center gap-10 text-4xl font-semibold mt-8">
      <li v-for="item in nav" :key="`m-${item.to}`" @click="emitClose">
        <NuxtLink
          :to="item.to"
          :class="[mobileLink, isActive(item) && linkActive]"
          class="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
          :aria-current="isActive(item) ? 'page' : undefined"
        >
          {{ $t(item.label) }}
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import NavbarLogo  from './NavbarLogo.vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'

interface NavItem { to:string; hash:string; label:string }
interface Lang    { code:string; flag:string; name:string }

const props = defineProps<{
  open       : boolean
  nav        : NavItem[]
  langs      : Lang[]
  locale     : string
  mobileLink : string
  linkActive : string
  isActive   : (i:NavItem)=>boolean
}>()

const emit = defineEmits(['close', 'update:locale'])
const emitClose = () => emit('close')
</script> -->
<template>
  <transition name="fade">
    <div
      v-if="open"
      class="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm md:hidden"
    >
      <nav class="flex flex-col gap-6 text-center">
        <NuxtLink
          v-for="item in nav"
          :key="item.label"
          :to="item.to"
          class="text-2xl font-bold text-white hover:text-blue-400 transition-colors"
          @click="$emit('close')"
        >
          {{ t(item.label) }}
        </NuxtLink>
      </nav>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

defineProps<{ open: boolean; nav: { to: string; label: string }[] }>()
defineEmits<['close']>()
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
