// websocket_gateway.model.ts (TypeScript strict) => Value Object de una conexión WebSocket (Socket.io) activa.
// Sin base de datos: las conexiones viven en memoria mientras el socket está abierto (se borran al desconectar).
export interface WsConnection {
  readonly id: string; // socket.id de Socket.io
  readonly userId: string;
  readonly roles: readonly string[];
  readonly ip: string;
  readonly topics: readonly string[];
  readonly connectedAt: string;
  readonly lastSeenAt: string;
  readonly messages: number; // Mensajes publicados por el cliente desde que se conectó
}

// Límites por conexión (protegen memoria y CPU del proceso compartido con la API)
export const WS_LIMITS = {
  maxTopicsPerConnection: 20,
  maxMessagesPerWindow: 20, // 20 mensajes...
  windowMs: 10_000, // ...cada 10 s
  maxPayloadBytes: 8 * 1024, // 8 KB por mensaje
} as const;
