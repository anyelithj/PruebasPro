// useWebSocket.ts (VueUse) => WebSocket nativo con reconexión exponencial y pausa cuando la pestaña está oculta
// (no se mantienen conexiones ni latidos en segundo plano: ahorro de batería). Pensado para el gateway WebSocket
// de Rust (Fase 9); Socket.io de Express se usa solo en la tienda Next.js. Sin "heartbeat": el cierre con la pestaña
// oculta ya evita conexiones muertas y no se envían latidos periódicos (menos energía). Patrón Observer.
import { watch } from "vue";
import { useDocumentVisibility, useWebSocket as useVueUseWebSocket } from "@vueuse/core";

export function useLiveSocket<T>(url: string, onMessage: (message: T) => void) {
  const visibility = useDocumentVisibility();
  const socket = useVueUseWebSocket(url, {
    immediate: visibility.value === "visible",
    autoReconnect: { retries: 5, delay: 2000 }, // Reintentos acotados: no golpea un servidor caído sin fin
    onMessage: (_ws, event: MessageEvent<string>) => {
      try {
        onMessage(JSON.parse(event.data) as T);
      } catch {
        // Mensajes que no son JSON (pong) se ignoran
      }
    },
  });

  // Pestaña oculta => cierra; visible => reabre (Observer de visibilidad)
  watch(visibility, (state) => (state === "visible" ? socket.open() : socket.close()));
  return socket;
}
