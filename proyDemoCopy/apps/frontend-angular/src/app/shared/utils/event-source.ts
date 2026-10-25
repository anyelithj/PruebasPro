import { Observable } from 'rxjs';
// [fromEventSource · shared/utils]: Server-Sent Events como Observable tipado (lo usan Notifications y Reports) | [Patrón]: Adapter (EventSource → Observable) + Observer | [Principio]: DRY (2+ funcionalidades) + SRP | [Paradigma]: Reactivo + Funcional
// [Tecnología]: EventSource (Web API) → reconexión automática y cabecera Last-Event-ID sin código extra; el BFF de Next.js pone el JWT

// `export interface` (TS): evento recibido con su nombre (`event:` del flujo) y el JSON ya parseado
export interface SseMessage<T> {
  type: string;
  data: T;
  id?: string;
}

// [fromEventSource]: `types` = eventos a escuchar ('notification', 'report-export'…); los `ping` del servidor se ignoran
// `new Observable` (RxJS): frío → abre la conexión al suscribirse y la cierra al desuscribirse (teardown)
export function fromEventSource<T>(url: string, types: readonly string[]): Observable<SseMessage<T>> {
  return new Observable<SseMessage<T>>((subscriber) => {
    const source = new EventSource(url, { withCredentials: true });
    const listener = (e: Event) => {
      const msg = e as MessageEvent<string>;
      try {
        subscriber.next({ type: msg.type, data: JSON.parse(msg.data) as T, id: msg.lastEventId || undefined });
      } catch {
        // JSON mal formado → se descarta ese evento; el flujo sigue
      }
    };
    types.forEach((t) => source.addEventListener(t, listener));
    return () => {
      types.forEach((t) => source.removeEventListener(t, listener));
      source.close(); // Sin fugas: cierra el socket y detiene la reconexión
    };
  });
}

// ───── [Sprint 7.11] Parser puro del texto SSE (lo usan postSse y los modelos de dominio; sin Angular HTTP) ─────
export type SseData = Record<string, unknown>;

// [parseSseText]: texto SSE acumulado → mensajes completos + resto sin terminar (los eventos se separan con línea en blanco) | Puro
export function parseSseText(buffer: string): { messages: SseMessage<SseData>[]; rest: string } {
  const frames = buffer.split('\n\n');
  const rest = frames.pop() ?? ''; // Último trozo: puede estar a medias
  const messages: SseMessage<SseData>[] = [];
  for (const frame of frames) {
    const type = /^event: ?(.*)$/m.exec(frame)?.[1]?.trim();
    const raw = /^data: ?(.*)$/m.exec(frame)?.[1] ?? '{}';
    try {
      if (type) messages.push({ type, data: JSON.parse(raw) as SseData });
    } catch {
      // Trozo corrupto → se ignora; el flujo sigue
    }
  }
  return { messages, rest };
}
