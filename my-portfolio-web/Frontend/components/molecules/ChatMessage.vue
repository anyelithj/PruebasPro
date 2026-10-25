<!--
  [Atomic Design: Molecule — burbuja de mensaje IA (usuario | asistente) con streaming.]
  [SOLID/SRP: solo presenta un mensaje. UX: caret parpadeante mientras streamea.]
  [a11y: role=listitem esperado en lista; aria-live en el asistente para SR.]
-->
<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '~/components/atoms/AppIcon.vue';

const props = withDefaults(
  defineProps<{ role: 'user' | 'assistant'; content: string; streaming?: boolean }>(),
  { streaming: false },
);

const isUser = computed(() => props.role === 'user');
</script>

<template>
  <div
    class="flex gap-3"
    :class="isUser ? 'flex-row-reverse' : 'flex-row'"
    role="listitem"
  >
    <span
      class="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
      :class="isUser ? 'bg-blue-600' : 'bg-purple-600'"
      aria-hidden="true"
    >
      <AppIcon :icon="isUser ? ['fas', 'user'] : ['fas', 'robot']" />
    </span>
    <div
      class="max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed"
      :class="
        isUser
          ? 'bg-blue-600 text-white rounded-tr-sm'
          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100 rounded-tl-sm'
      "
      :aria-live="role === 'assistant' ? 'polite' : undefined"
    >
      <span class="whitespace-pre-wrap break-words">{{ content }}</span>
      <span v-if="streaming" class="chat-caret" aria-hidden="true">▋</span>
    </div>
  </div>
</template>

<style scoped>
.chat-caret {
  animation: caretBlink 1s step-end infinite;
}
@keyframes caretBlink {
  50% {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .chat-caret {
    animation: none !important;
  }
}
</style>
