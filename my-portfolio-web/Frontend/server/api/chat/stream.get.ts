// [MVC-C][PROXY][OBSERVER] GET /api/chat/stream — pipea el SSE del chat IA del backend.
// EventSource solo hace GET; el backend Nest expone POST /chat/stream con body JSON.
// Este proxy traduce: recibe GET (query) → hace POST al backend → reenvía el stream SSE.
import { defineEventHandler, getQuery, setResponseHeaders, sendStream, createError } from 'h3';
import { useRuntimeConfig } from '#imports';
import { resolveBackendBase } from '../../utils/response';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const q = getQuery(event);
  const message = String(q.message ?? '');
  if (!message) {
    throw createError({ statusCode: 400, statusMessage: 'message requerido' });
  }
  const sessionId = String(q.sessionId ?? `web-${Date.now()}`);
  const aiProvider = String(q.provider ?? 'ollama'); // 'ollama' | 'rag'
  const provider = String(q.backend ?? config.public.apiProvider);

  const base = resolveBackendBase(provider, {
    fastapiBaseUrl: config.fastapiBaseUrl as string,
    nestBaseUrl: config.nestBaseUrl as string,
  });

  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  try {
    // Backend: POST /chat/stream { content, sessionId, provider } → text/event-stream.
    const upstream = await fetch(`${base}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ content: message, sessionId, provider: aiProvider }),
    });
    if (!upstream.ok || !upstream.body) {
      const payload = JSON.stringify({
        type: 'error',
        content: `Chat no disponible (${upstream.status}).`,
      });
      return `data: ${payload}\n\ndata: [DONE]\n\n`;
    }
    return sendStream(event, upstream.body as ReadableStream);
  } catch {
    const payload = JSON.stringify({
      type: 'error',
      content: 'No se pudo conectar con el backend de chat.',
    });
    return `data: ${payload}\n\ndata: [DONE]\n\n`;
  }
});
