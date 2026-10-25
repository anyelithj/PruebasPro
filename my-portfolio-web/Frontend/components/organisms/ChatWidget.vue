<!--
  [Atomic Design: Organism — widget de chat IA flotante, global en todo el sitio.]
  [FACADE: oculta useChat (SSE) tras un botón + panel simples.]
  [SOLID/SRP: solo presenta; toda la lógica vive en useChat.]
  [a11y: dialog con aria-modal, foco al abrir, aria-live en la lista, labels. UX: burbuja fija.]
-->
<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import AppIcon from '~/components/atoms/AppIcon.vue';
import ChatMessage from '~/components/molecules/ChatMessage.vue';
import { useChat } from '~/composables/useChat';

const { messages, isStreaming, error, send, reset } = useChat();

const open = ref(false);
const draft = ref('');
const inputEl = ref<HTMLInputElement | null>(null);
const listEl = ref<HTMLElement | null>(null);

function toggle(): void {
  open.value = !open.value;
}

function onSubmit(): void {
  const text = draft.value;
  if (!text.trim() || isStreaming.value) return;
  send(text);
  draft.value = '';
}

// Autoscroll al fondo cuando llegan mensajes/chunks; foco al abrir.
watch(
  () => [messages.value.length, messages.value[messages.value.length - 1]?.content, open.value],
  async () => {
    await nextTick();
    if (open.value) {
      listEl.value?.scrollTo({ top: listEl.value.scrollHeight });
      if (!messages.value.length) inputEl.value?.focus();
    }
  },
);
</script>

<template>
  <!-- Botón flotante -->
  <button
    type="button"
    class="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg transition hover:scale-105 hover:bg-purple-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-300"
    :aria-expanded="open"
    aria-controls="chat-panel"
    :aria-label="open ? 'Cerrar asistente IA' : 'Abrir asistente IA'"
    @click="toggle"
  >
    <AppIcon :icon="open ? ['fas', 'times'] : ['fas', 'robot']" :aria-hidden="true" />
  </button>

  <!-- Panel -->
  <transition name="chat-pop">
    <section
      v-if="open"
      id="chat-panel"
      role="dialog"
      aria-modal="false"
      aria-label="Asistente IA del portafolio"
      class="fixed bottom-24 right-5 z-[60] flex h-[30rem] w-[92vw] max-w-sm flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
    >
      <!-- Cabecera -->
      <header class="flex items-center justify-between border-b border-gray-100 bg-purple-600 px-4 py-3 text-white dark:border-gray-800">
        <span class="flex items-center gap-2 font-bold">
          <AppIcon :icon="['fas', 'robot']" :aria-hidden="true" />
          Asistente IA
        </span>
        <button
          type="button"
          class="rounded p-1 text-white/80 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Reiniciar conversación"
          @click="reset"
        >
          <AppIcon :icon="['fas', 'rotate-right']" :aria-hidden="true" />
        </button>
      </header>

      <!-- Lista de mensajes -->
      <div
        ref="listEl"
        class="flex-1 space-y-4 overflow-y-auto p-4"
        role="list"
        aria-live="polite"
      >
        <p
          v-if="!messages.length"
          class="mt-8 text-center text-sm text-gray-400 dark:text-gray-500"
        >
          Pregúntame sobre proyectos, tecnologías o experiencia.
        </p>
        <ChatMessage
          v-for="(m, i) in messages"
          :key="i"
          :role="m.role"
          :content="m.content"
          :streaming="isStreaming && i === messages.length - 1 && m.role === 'assistant'"
        />
      </div>

      <p v-if="error" role="alert" class="px-4 pb-1 text-xs text-red-600 dark:text-red-400">
        {{ error }}
      </p>

      <!-- Entrada -->
      <form class="flex gap-2 border-t border-gray-100 p-3 dark:border-gray-800" @submit.prevent="onSubmit">
        <label for="chat-input" class="sr-only">Escribe tu mensaje</label>
        <input
          id="chat-input"
          ref="inputEl"
          v-model="draft"
          type="text"
          maxlength="4000"
          placeholder="Escribe tu mensaje…"
          class="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        <button
          type="submit"
          :disabled="isStreaming || !draft.trim()"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white transition hover:bg-purple-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          aria-label="Enviar mensaje"
        >
          <AppIcon :icon="['fas', 'paper-plane']" :aria-hidden="true" />
        </button>
      </form>
    </section>
  </transition>
</template>

<style scoped>
.chat-pop-enter-active,
.chat-pop-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.chat-pop-enter-from,
.chat-pop-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}
@media (prefers-reduced-motion: reduce) {
  .chat-pop-enter-active,
  .chat-pop-leave-active {
    transition: none;
  }
}
</style>
