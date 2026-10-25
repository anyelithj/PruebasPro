// [SRP] gestión admin del chat: system prompt editable + historial de sesiones (backend Nest).
import { ref } from 'vue';
import { useApi } from '~/composables/useApi';
import { useAuthStore } from '~/stores/useAuthStore';

export interface ChatSession {
  sessionId: string;
  messageCount: number;
  lastMessageAt: string;
}
export interface ChatMsg {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
}

export function useChatAdmin() {
  const auth = useAuthStore();
  const systemPrompt = ref('');
  const sessions = ref<ChatSession[]>([]);
  const messages = ref<ChatMsg[]>([]);
  const activeSession = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  function api() {
    return useApi(auth.provider);
  }

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    loading.value = true;
    error.value = null;
    try {
      return await fn();
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchSettings(): Promise<void> {
    await run(async () => {
      const r = await api().get<{ systemPrompt: string }>('/chat/settings');
      systemPrompt.value = r.systemPrompt;
    });
  }

  async function saveSettings(value: string): Promise<void> {
    await run(async () => {
      await api().patch('/chat/settings', { systemPrompt: value });
      systemPrompt.value = value;
    });
  }

  async function fetchSessions(): Promise<void> {
    await run(async () => {
      sessions.value = await api().get<ChatSession[]>('/chat/sessions');
    });
  }

  async function openSession(sessionId: string): Promise<void> {
    await run(async () => {
      activeSession.value = sessionId;
      messages.value = await api().get<ChatMsg[]>(`/chat/history/${sessionId}`);
    });
  }

  async function removeSession(sessionId: string): Promise<void> {
    await run(async () => {
      await api().del(`/chat/history/${sessionId}`);
      if (activeSession.value === sessionId) {
        activeSession.value = null;
        messages.value = [];
      }
      await fetchSessions();
    });
  }

  return {
    systemPrompt,
    sessions,
    messages,
    activeSession,
    loading,
    error,
    fetchSettings,
    saveSettings,
    fetchSessions,
    openSession,
    removeSession,
  };
}
