<!-- Ejemplo para Button.vue -->
<!-- <template>
  <button
    :class="['btn', variant]"
    :aria-label="ariaLabel"
    :title="ariaLabel"
    :type="type"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost',
  ariaLabel?: string,
  type?: 'submit' | 'button'
}>()
</script> -->
<template>
  <button
    :class="[
      'px-4 py-2 rounded focus:outline-none focus-visible:ring focus-visible:ring-offset-2 transition-all font-semibold',
      variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-900 hover:bg-gray-300',
      disabled ? 'opacity-50 cursor-not-allowed' : ''
    ]"
    :aria-disabled="disabled"
    :type="type"
    @click="$emit('click')"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}>()
</script>
