// [PROXY][OBSERVER] SSE proxy → agente blockchain Solana (FastAPI GET SSE).
// EventSource solo hace GET: se pasan message/wallet por query y se pipea el stream.
import { defineEventHandler, getQuery, setResponseHeaders, sendStream, createError } from 'h3';
import { useRuntimeConfig } from '#imports';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const q = getQuery(event);
  const message = String(q.message ?? '');
  if (!message) {
    throw createError({ statusCode: 400, statusMessage: 'message requerido' });
  }
  const wallet = q.wallet ? `&wallet=${encodeURIComponent(String(q.wallet))}` : '';
  // Streaming SSE lo sirve FastAPI (fuente de verdad del agente).
  const base = config.fastapiBaseUrl as string;
  const url = `${base}/blockchain/solana/stream?message=${encodeURIComponent(message)}${wallet}`;

  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    throw createError({ statusCode: 502, statusMessage: `Agente Solana no disponible (${upstream.status})` });
  }
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  return sendStream(event, upstream.body as ReadableStream);
});
