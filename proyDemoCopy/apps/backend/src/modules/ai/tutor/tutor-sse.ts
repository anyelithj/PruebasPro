import { Readable } from 'node:stream';
import { setTimeout as sleep } from 'node:timers/promises';
import type { TutorTurnResult } from './tutor-conversation.service';
// [tutorSse · 2026-10-28]: respuesta ya guardada del Tutor IA → flujo SSE (session · token por palabra · saved · done) | [Patrón]: Adapter (JSON → SSE) + Iterator (async generator) | [Principio]: OCP (el cliente SSE de Angular no cambia: `saved` es un evento nuevo que antes no existía) | [Paradigma]: Funcional + asíncrono
// [Por qué aquí]: antes NestJS canalizaba el SSE de FastAPI tal cual; ahora NestJS guarda los turnos (renombrar/editar/borrar) → necesita la respuesta completa (FastAPI ya la calculaba entera antes de «streamear»)

const TOKEN_DELAY_MS = 15; // Ritmo de escritura visible (FastAPI usaba 20 ms)
const ev = (event: string, data: unknown): string => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

// `async function*` (ES2018): generador asíncrono → `Readable.from` lo consume con contrapresión; `signal` corta la espera si el cliente se va
async function* frames(r: TutorTurnResult, signal?: AbortSignal): AsyncGenerator<string> {
  yield ev('session', { session_id: r.conversation.id });
  // `\S+\s*`: palabra + su espacio original → se conservan los saltos de línea (misma partición que FastAPI y Help)
  for (const text of r.assistantMessage.content.match(/\S+\s*/g) ?? []) {
    if (signal?.aborted) return;
    yield ev('token', { text });
    await sleep(TOKEN_DELAY_MS);
  }
  // [saved]: ids reales de los dos mensajes + resumen de la conversación (título, uso del idioma) → la UI habilita editar/borrar al instante
  yield ev('saved', r);
  yield ev('done', {});
}

export const tutorSse = (r: TutorTurnResult, signal?: AbortSignal): Readable => Readable.from(frames(r, signal));
