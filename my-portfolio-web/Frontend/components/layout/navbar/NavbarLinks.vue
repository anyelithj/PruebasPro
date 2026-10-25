<!-- <template>
    <div class="hidden md:flex items-center gap-6">
        <ul class="flex gap-5 text-lg font-semibold">
            <li v-for="item in nav" :key="item.to">
                <NuxtLink :to="item.to" :class="[linkBase, isActive(item) && linkActive]"
                    :aria-current="isActive(item) ? 'page' : undefined"
                    class="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500">
                    {{ $t(item.label) }}
                </NuxtLink>
            </li>
        </ul>

        <label class="sr-only" :for="`locale-${uniqueId}`">{{ $t('language') }}</label>
        <select :id="`locale-${uniqueId}`" :value="locale"
            @change="$emit('update:locale', ($event.target as HTMLSelectElement).value)" class="rounded border border-gray-300 bg-gray-100 px-2 py-1 text-sm text-gray-800 transition
             hover:ring-2 hover:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white
             focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2">
            <option v-for="l in langs" :key="l.code" :value="l.code">
                {{ l.flag }} {{ l.name }}
            </option>
        </select>

        <ThemeToggle />
    </div>
</template>
<script setup lang="ts">
import ThemeToggle from '@/components/ui/ThemeToggle.vue'

interface NavItem { to: string; hash: string; label: string }
interface Lang { code: string; flag: string; name: string }

defineProps<{
    nav: NavItem[]
    langs: Lang[]
    locale: string
    linkBase: string
    linkActive: string
    isActive: (i: NavItem) => boolean
}>()

defineEmits(['update:locale'])

// Usa crypto.randomUUID() en vez de uid()
const uniqueId = crypto.randomUUID()
</script>
<!-- <script setup lang="ts">
import uid from 'uid'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'

interface NavItem { to: string; hash: string; label: string }
interface Lang { code: string; flag: string; name: string }

defineProps<{
    nav: NavItem[]
    langs: Lang[]
    locale: string
    linkBase: string
    linkActive: string
    isActive: (i: NavItem) => boolean
}>()

defineEmits(['update:locale'])

// Renombrar la constante para evitar conflicto
const uniqueId = uid()
</script> -->

<!-- <script setup lang="ts">
import uid from 'uid'
// import { uid }        from 'uid'     
import ThemeToggle    from '@/components/ui/ThemeToggle.vue'

interface NavItem { to:string; hash:string; label:string }
interface Lang    { code:string; flag:string; name:string }

defineProps<{
  nav        : NavItem[]
  langs      : Lang[]
  locale     : string
  linkBase   : string
  linkActive : string
  isActive   : (i:NavItem)=>boolean
}>()

defineEmits(['update:locale'])

const uid = uid()      
</script> --> 
<template>
  <nav class="hidden md:flex items-center gap-6">
    <NuxtLink
      v-for="item in nav"
      :key="item.label"
      :to="item.to"
      class="text-base font-semibold text-gray-700 dark:text-white transition-colors hover:text-blue-500"
      :aria-label="item.label"
    >
      {{ t(item.label) }}
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

defineProps<{ nav: { to: string; label: string }[] }>()
</script>
