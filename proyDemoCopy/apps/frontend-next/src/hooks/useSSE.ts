"use client"; // [Next.js]: hook de navegador (EventSource no existe en el servidor)
import { useEffect, useRef } from "react";
// [useSSE · Sprint 6.2]: suscribe un componente a un evento de un flujo Server-Sent Events | [Patrón]: Custom Hook + Observer + Flyweight (UNA conexión por URL compartida por todos los suscriptores) | [Principio]: DRY + SRP | [Paradigma]: Reactivo + Declarativo
// [Tecnología]: EventSource (Web API nativa) → reconexión automática y cabecera Last-Event-ID sin código extra (el backend reenvía lo perdido)

// [SSOT]: URL del flujo SSE de avisos (BFF) — la campana del topbar y futuros oyentes comparten una conexión
export const NOTIFICATIONS_STREAM = "/api/notifications/stream";

// [Conexión compartida]: varios componentes que escuchan el mismo flujo → un solo socket abierto (el navegador limita ~6 por origen en HTTP/1.1)
interface SharedSource {
  source: EventSource;
  users: number; // Contador de referencias: se cierra cuando se va el último suscriptor
}
const sources = new Map<string, SharedSource>(); // `Map` (ES2015): URL → conexión

// [acquire / release]: abre o reutiliza la conexión de la URL | [Patrón]: Reference Counting
function acquire(url: string): EventSource {
  const shared = sources.get(url) ?? { source: new EventSource(url), users: 0 };
  shared.users += 1;
  sources.set(url, shared);
  return shared.source;
}
function release(url: string): void {
  const shared = sources.get(url);
  if (!shared || --shared.users > 0) return;
  shared.source.close(); // `close()` (EventSource): corta el flujo y detiene la reconexión
  sources.delete(url);
}

// `export function useSSE<T>` (TS genérico): `T` = forma del `data` JSON del evento | `onMessage` puede cambiar en cada render sin reabrir el socket
export function useSSE<T>(url: string, event: string, onMessage: (data: T) => void): void {
  // `useRef` (React): guarda el último callback → el efecto no depende de él (evita reconexiones por render)
  const handler = useRef(onMessage);
  useEffect(() => {
    handler.current = onMessage;
  });

  useEffect(() => {
    const source = acquire(url);
    // `MessageEvent.data` (Web API): texto del evento → JSON; los latidos `ping` no llegan aquí porque escuchamos un tipo concreto
    const listener = (e: MessageEvent<string>) => {
      try {
        handler.current(JSON.parse(e.data) as T);
      } catch {
        // JSON mal formado → se ignora; un evento roto no debe tumbar la interfaz
      }
    };
    source.addEventListener(event, listener as EventListener);
    // [Cleanup]: quita el oyente y libera la conexión al desmontar o cambiar de URL
    return () => {
      source.removeEventListener(event, listener as EventListener);
      release(url);
    };
  }, [url, event]);
}
