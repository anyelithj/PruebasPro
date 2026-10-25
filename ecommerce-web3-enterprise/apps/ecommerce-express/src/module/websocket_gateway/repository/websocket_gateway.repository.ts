// websocket_gateway.repository.ts (Map nativa) => registro en memoria de conexiones activas y su metadata.
// Patrón Repository: el service no conoce la estructura interna. Sin locks: el event loop serializa los accesos.
// Memoria acotada: una entrada por socket abierto; "remove" al desconectar (sin fugas).
import type { WsConnection } from "../model/websocket_gateway.model";

// ConnectionRecord => estado MUTABLE interno (el exterior solo ve el WsConnection inmutable de "toConnection")
interface ConnectionRecord {
  id: string;
  userId: string;
  roles: readonly string[];
  ip: string;
  topics: Set<string>;
  connectedAt: number;
  lastSeenAt: number;
  messages: number;
  windowStart: number; // Inicio de la ventana del límite de mensajes
  windowCount: number;
}

export class WebsocketGatewayRepository {
  private readonly connections = new Map<string, ConnectionRecord>();

  public add(id: string, userId: string, roles: readonly string[], ip: string, now = Date.now()): void {
    this.connections.set(id, { id, userId, roles, ip, topics: new Set(), connectedAt: now, lastSeenAt: now, messages: 0, windowStart: now, windowCount: 0 });
  }

  public remove(id: string): void {
    this.connections.delete(id);
  }

  public get(id: string): WsConnection | null {
    const record = this.connections.get(id);
    return record ? toConnection(record) : null;
  }

  public list(): WsConnection[] {
    return [...this.connections.values()].map(toConnection);
  }

  public topicCount(id: string): number {
    return this.connections.get(id)?.topics.size ?? 0;
  }

  public addTopic(id: string, topic: string): void {
    this.connections.get(id)?.topics.add(topic);
  }

  public removeTopic(id: string, topic: string): void {
    this.connections.get(id)?.topics.delete(topic);
  }

  // consumeMessage => ventana fija por conexión: true si el mensaje entra en el cupo
  public consumeMessage(id: string, limit: number, windowMs: number, now = Date.now()): boolean {
    const record = this.connections.get(id);
    if (!record) return false;
    if (now - record.windowStart >= windowMs) {
      record.windowStart = now;
      record.windowCount = 0;
    }
    record.lastSeenAt = now;
    if (record.windowCount >= limit) return false;
    record.windowCount += 1;
    record.messages += 1;
    return true;
  }

  public get size(): number {
    return this.connections.size; // "get" => accesor de propiedad (se lee como repository.size)
  }
}

function toConnection(record: ConnectionRecord): WsConnection {
  return {
    id: record.id,
    userId: record.userId,
    roles: record.roles,
    ip: record.ip,
    topics: [...record.topics],
    connectedAt: new Date(record.connectedAt).toISOString(),
    lastSeenAt: new Date(record.lastSeenAt).toISOString(),
    messages: record.messages,
  };
}
