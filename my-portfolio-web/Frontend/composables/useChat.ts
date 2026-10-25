// [OBSERVER][FP] chat IA vía SSE (EventSource → BFF Nitro → backend Nest/FastAPI).
// SRP: orquesta mensajes + sesión + streaming. La UI (ChatWidget) solo presenta.
import { onScopeDispose, ref } from 'vue';
import { streamEventSchema, type ChatMessage } from '~/shared/schemas/chat.schema';

// Id de sesión estable por pestaña (el backend agrupa el historial por sessionId).
function makeSessionId(): string {
  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useChat() {
  const sessionId = ref(makeSessionId());
  const messages = ref<ChatMessage[]>([]);
  const isStreaming = ref(false);
  const error = ref<string | null>(null);
  let source: EventSource | null = null;

  function stop(): void {
    source?.close();
    source = null;
    isStreaming.value = false;
  }

  // Referencia al mensaje del asistente en curso, para ir concatenando chunks.
  function currentAssistant(): ChatMessage | undefined {
    const last = messages.value[messages.value.length - 1];
    return last?.role === 'assistant' ? last : undefined;
  }

  function send(text: string): void {
    const content = text.trim();
    if (!content || isStreaming.value) return;

    stop();
    error.value = null;
    messages.value = [
      ...messages.value,
      { role: 'user', content },
      { role: 'assistant', content: '' }, // burbuja que se irá rellenando
    ];
    isStreaming.value = true;

    const params = new URLSearchParams({ message: content, sessionId: sessionId.value });
    source = new EventSource(`/api/chat/stream?${params.toString()}`);

    source.onmessage = (e: MessageEvent<string>): void => {
      if (e.data === '[DONE]') {
        stop();
        return;
      }
      const parsed = streamEventSchema.safeParse(safeJson(e.data));
      if (!parsed.success) return; // frame parcial/no-JSON → ignorar
      const ev = parsed.data;
      const assistant = currentAssistant();
      switch (ev.type) {
        case 'chunk':
          if (assistant) assistant.content += ev.content ?? '';
          break;
        case 'error':
          error.value = ev.content ?? 'Error del asistente';
          if (assistant && !assistant.content) assistant.content = error.value;
          stop();
          break;
        case 'done':
          stop();
          break;
        // 'source' (citas RAG) se ignora en la burbuja; se podría mostrar aparte.
      }
    };

    source.onerror = (): void => {
      if (isStreaming.value) error.value = 'Conexión interrumpida';
      stop();
    };
  }

  function reset(): void {
    stop();
    messages.value = [];
    error.value = null;
    sessionId.value = makeSessionId();
  }

  onScopeDispose(stop);

  return { sessionId, messages, isStreaming, error, send, stop, reset };
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
