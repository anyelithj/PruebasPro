<!-- <template>
  <button
    :aria-expanded="open"
    aria-label="Toggle menu"
    class="md:hidden text-gray-800 dark:text-white transition-transform duration-300
           hover:scale-110 active:scale-90 focus-visible:ring-2 focus-visible:ring-offset-2
           focus-visible:ring-blue-500"
    @click="emit('toggle')"
  >
    <font-awesome-icon
      :icon="open ? ['fas', 'times'] : ['fas', 'bars']"
      size="lg"
      :class="open ? 'rotate-90' : ''"
      class="transition-transform duration-300"
    />
  </button>
</template>

<script setup lang="ts">
defineProps<{ open: boolean }>()
const emit = defineEmits(['toggle'])
</script> -->
<template>
  <button
    :aria-expanded="open"
    aria-label="Toggle menu"
    class="md:hidden text-gray-800 dark:text-white transition-transform duration-300
           hover:scale-110 active:scale-90 focus-visible:ring-2 focus-visible:ring-offset-2
           focus-visible:ring-blue-500"
    @click="$emit('toggle')"
  >
    <font-awesome-icon
      :icon="open ? ['fas', 'times'] : ['fas', 'bars']"
      size="lg"
      :class="open ? 'rotate-90' : ''"
      class="transition-transform duration-300"
    />
  </button>
</template>

<script setup lang="ts">
defineProps<{ open: boolean }>()
defineEmits<['toggle']>()
</script>