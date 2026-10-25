<script setup lang="ts">
defineProps<{
  title: string
  description: string
  link: string
  techs: string[]
}>()
</script>

<template>
  <div
    class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition duration-300"
  >
    <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-2">
      <font-awesome-icon icon="folder-open" class="mr-2 text-indigo-500" />
      {{ title }}
    </h3>

    <p class="text-gray-600 dark:text-gray-300">{{ description }}</p>

    <ul class="flex flex-wrap gap-2 mt-4">
      <li
        v-for="(tech, index) in techs"
        :key="index"
        class="text-xs bg-indigo-100 dark:bg-indigo-700 text-indigo-700 dark:text-white px-2 py-1 rounded"
      >
        {{ tech }}
      </li>
    </ul>

    <a
      :href="link"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center gap-2 mt-4 text-sm text-indigo-600 dark:text-indigo-300 hover:underline"
    >
      <font-awesome-icon icon="arrow-right" />
      Ver proyecto
    </a>
  </div>
</template>
