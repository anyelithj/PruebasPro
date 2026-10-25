
<template>
  <div
    class="rounded-2xl shadow-lg p-6 bg-white dark:bg-neutral-900 transition-transform duration-300 ease-in-out hover:scale-105"
    :aria-label="title"
    role="article"
  >
    <h3 class="text-xl font-semibold mb-2 text-primary">{{ title }}</h3>
    <p class="text-base text-gray-700 dark:text-gray-300">{{ description }}</p>
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()
</script>