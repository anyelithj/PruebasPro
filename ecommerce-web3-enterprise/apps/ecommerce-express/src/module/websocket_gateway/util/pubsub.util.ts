// pubsub.util.ts (Socket.io) => Pub/Sub filtrado por tópico sobre las "rooms" de Socket.io (sin broker extra).
// Tópicos con prefijo de visibilidad: "public:<nombre>" (cualquier usuario), "user:<id>" (solo ese usuario) y
// "admin:<nombre>" (solo administradores). Funciones puras de autorización + un emisor (patrón Publish-Subscribe).
import type { Namespace } from "socket.io";
import { z } from "zod";

export const TopicSchema = z.string().regex(/^(public|user|admin):[a-z0-9_.-]{1,80}$/i, { message: "Tópico inválido (public:x | user:<id> | admin:x)" });

// Actor => quién se suscribe o publica (id + roles del JWT)
export interface Actor {
  readonly id: string;
  readonly roles: readonly string[];
}

const isAdminActor = (actor: Actor) => actor.roles.includes("ADMIN");

export const topicRoom = (topic: string) => `topic:${topic}`; // Room de Socket.io asociada al tópico

// canSubscribe => público: todos; user:<id>: solo el dueño; admin:*: solo ADMIN
export function canSubscribe(topic: string, actor: Actor): boolean {
  if (isAdminActor(actor) || topic.startsWith("public:")) return true;
  return topic === `user:${actor.id}`;
}

// canPublish => los clientes solo publican en tópicos públicos; el ADMIN (y el servidor) en cualquiera
export function canPublish(topic: string, actor: Actor): boolean {
  return isAdminActor(actor) || topic.startsWith("public:");
}

// publish => entrega el mensaje SOLO a los suscriptores del tópico ("except" evita el eco al emisor)
export function publish(nsp: Namespace, topic: string, payload: unknown, exceptSocketId?: string): void {
  const target = exceptSocketId ? nsp.to(topicRoom(topic)).except(exceptSocketId) : nsp.to(topicRoom(topic));
  target.emit("gateway:message", { topic, payload, at: new Date().toISOString() });
}
