<!-- [MVC-V] Administración del chat IA — system prompt editable + historial. Middleware admin. -->
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { definePageMeta } from '#imports';
import { useChatAdmin } from '~/composables/useChatAdmin';
import { useToast } from '~/composables/useToast';

definePageMeta({ middleware: 'admin', layout: 'admin' });

const chat = useChatAdmin();
const toast = useToast();
const draftPrompt = ref('');

onMounted(async () => {
  await Promise.allSettled([chat.fetchSettings(), chat.fetchSessions()]);
  draftPrompt.value = chat.systemPrompt.value;
});

async function savePrompt(): Promise<void> {
  try {
    await chat.saveSettings(draftPrompt.value.trim());
    toast.success('System prompt guardado');
  } catch (e) {
    toast.error((e as Error).message);
  }
}

async function onDelete(sessionId: string): Promise<void> {
  if (!confirm('¿Borrar esta conversación completa?')) return;
  try {
    await chat.removeSession(sessionId);
    toast.success('Conversación eliminada');
  } catch (e) {
    toast.error((e as Error).message);
  }
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('es');
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-8">
    <header>
      <h1 class="text-2xl font-black sm:text-3xl">Chat IA</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        El "guion" del asistente (system prompt) e historial de conversaciones.
      </p>
    </header>

    <!-- System prompt editable -->
    <section class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
      <h2 class="mb-1 flex items-center gap-2 text-lg font-bold">
        <font-awesome-icon :icon="['fas', 'robot']" class="text-indigo-500" />
        System prompt (guion del asistente)
      </h2>
      <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Las respuestas las genera la IA (Ollama). Este texto define su personalidad e
        instrucciones. Se aplica a la próxima conversación.
      </p>
      <textarea
        v-model="draftPrompt"
        rows="6"
        class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-gray-600 dark:bg-slate-800 dark:text-white"
        placeholder="Eres el asistente del portafolio de…"
      ></textarea>
      <div class="mt-3 flex gap-3">
        <button
          type="button"
          :disabled="chat.loading.value || !draftPrompt.trim()"
          class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          @click="savePrompt"
        >
          <font-awesome-icon :icon="['fas', 'floppy-disk']" />
          Guardar
        </button>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
          @click="draftPrompt = chat.systemPrompt.value"
        >
          Revertir
        </button>
      </div>
    </section>

    <!-- Historial de conversaciones -->
    <section class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
        <h2 class="mb-3 text-lg font-bold">Conversaciones ({{ chat.sessions.value.length }})</h2>
        <p v-if="!chat.sessions.value.length" class="text-sm text-gray-400">
          Aún no hay conversaciones.
        </p>
        <ul class="space-y-2">
          <li
            v-for="s in chat.sessions.value"
            :key="s.sessionId"
            class="flex items-center justify-between rounded-lg border border-gray-100 p-3 dark:border-white/5"
            :class="chat.activeSession.value === s.sessionId ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''"
          >
            <button type="button" class="min-w-0 flex-1 text-left" @click="chat.openSession(s.sessionId)">
              <p class="truncate font-mono text-xs text-gray-700 dark:text-gray-300">{{ s.sessionId }}</p>
              <p class="text-xs text-gray-400">{{ s.messageCount }} mensajes · {{ fmt(s.lastMessageAt) }}</p>
            </button>
            <button
              type="button"
              class="ml-2 text-red-500 hover:text-red-600"
              title="Borrar conversación"
              @click="onDelete(s.sessionId)"
            >
              <font-awesome-icon :icon="['fas', 'trash']" />
            </button>
          </li>
        </ul>
      </div>

      <!-- Mensajes de la sesión seleccionada -->
      <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
        <h2 class="mb-3 text-lg font-bold">Mensajes</h2>
        <p v-if="!chat.activeSession.value" class="text-sm text-gray-400">
          Selecciona una conversación para ver los mensajes.
        </p>
        <div v-else class="max-h-96 space-y-3 overflow-y-auto">
          <div
            v-for="m in chat.messages.value"
            :key="m.id"
            class="rounded-lg p-2 text-sm"
            :class="m.role === 'user'
              ? 'bg-blue-50 text-blue-900 dark:bg-blue-500/10 dark:text-blue-200'
              : 'bg-gray-100 text-gray-800 dark:bg-white/5 dark:text-gray-200'"
          >
            <span class="mb-0.5 block text-[10px] font-bold uppercase opacity-60">
              {{ m.role === 'user' ? 'Visitante' : 'Asistente' }}
            </span>
            <span class="whitespace-pre-wrap break-words">{{ m.content }}</span>
          </div>
        </div>
      </div>
    </section>

    <p v-if="chat.error.value" class="text-sm text-red-500">{{ chat.error.value }}</p>
  </div>
</template>
