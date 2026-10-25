// websocket_gateway.service.ts (TypeScript + Socket.io) => lógica de la pasarela WebSocket (sprint 9.3).
// Ciclo de vida de la conexión (connect/disconnect), suscripciones por tópico con autorización, publicación con
// límite de mensajes y de tamaño por conexión, presencia por tópico y cierre ordenado de conexiones.
// Patrones: Pub/Sub (pubsub.util), Repository (conexiones en memoria) y Mediator (el service coordina socket + registro).
// Heartbeat: lo hace Socket.io (ping/pong cada 25 s); el cliente se reconecta solo si se cae la red.
import type { Namespace, Socket } from "socket.io";
import { WebsocketGatewayRepository } from "../repository/websocket_gateway.repository";
import { WS_LIMITS, type WsConnection } from "../model/websocket_gateway.model";
import { canPublish, canSubscribe, publish, topicRoom, TopicSchema, type Actor } from "../util/pubsub.util";
import { NotFoundException, ServiceUnavailableException } from "../../../shared/filter/http-exception.filter";

// Ack => respuesta al cliente por el callback de Socket.io: { ok } o { ok: false, error }
type Ack = (result: { ok: boolean; error?: string; subscribers?: number }) => void;

export class WebsocketGatewayService {
  private nsp: Namespace | null = null;

  constructor(private readonly repository = new WebsocketGatewayRepository()) {}

  // attach => el handler entrega el namespace "/rt/gateway" al registrarlo (bootstrap)
  public attach(nsp: Namespace): void {
    this.nsp = nsp;
  }

  // connect => registra la conexión y sus eventos (una vez por socket)
  public connect(socket: Socket, actor: Actor): void {
    this.repository.add(socket.id, actor.id, actor.roles, socket.handshake.address);
    void socket.join(topicRoom(`user:${actor.id}`)); // Tópico privado del usuario, siempre suscrito

    socket.on("gateway:subscribe", (topic: unknown, ack?: Ack) => this.reply(ack, () => this.subscribe(socket, actor, topic)));
    socket.on("gateway:unsubscribe", (topic: unknown, ack?: Ack) => this.reply(ack, () => this.unsubscribe(socket, topic)));
    socket.on("gateway:publish", (message: unknown, ack?: Ack) => this.reply(ack, () => this.publish(socket, actor, message)));
    // "disconnect" => Socket.io ya sacó el socket de sus rooms; aquí se libera la memoria del registro
    socket.on("disconnect", () => this.repository.remove(socket.id));
  }

  public list(): WsConnection[] {
    return this.repository.list();
  }

  public get(id: string): WsConnection {
    const connection = this.repository.get(id);
    if (!connection) throw new NotFoundException("Conexión WebSocket", id);
    return connection;
  }

  // close => cierre ordenado: avisa al cliente y desconecta (true => cierra el transporte, no solo el namespace)
  public close(id: string): void {
    const socket = this.namespace().sockets.get(id);
    if (!socket) throw new NotFoundException("Conexión WebSocket", id);
    socket.emit("gateway:closing", { reason: "closed_by_admin" });
    socket.disconnect(true);
  }

  // broadcast => API para otros módulos del servidor (publica en cualquier tópico, sin límite de cliente)
  public broadcast(topic: string, payload: unknown): void {
    publish(this.namespace(), TopicSchema.parse(topic), payload);
  }

  private subscribe(socket: Socket, actor: Actor, raw: unknown): { ok: boolean; error?: string; subscribers?: number } {
    const topic = TopicSchema.safeParse(raw);
    if (!topic.success) return { ok: false, error: "INVALID_TOPIC" };
    if (!canSubscribe(topic.data, actor)) return { ok: false, error: "FORBIDDEN" };
    if (this.repository.topicCount(socket.id) >= WS_LIMITS.maxTopicsPerConnection) return { ok: false, error: "TOO_MANY_TOPICS" };
    void socket.join(topicRoom(topic.data));
    this.repository.addTopic(socket.id, topic.data);
    return { ok: true, subscribers: this.presence(topic.data) };
  }

  private unsubscribe(socket: Socket, raw: unknown): { ok: boolean; error?: string } {
    const topic = TopicSchema.safeParse(raw);
    if (!topic.success) return { ok: false, error: "INVALID_TOPIC" };
    void socket.leave(topicRoom(topic.data));
    this.repository.removeTopic(socket.id, topic.data);
    return { ok: true };
  }

  private publish(socket: Socket, actor: Actor, raw: unknown): { ok: boolean; error?: string } {
    if (!this.repository.consumeMessage(socket.id, WS_LIMITS.maxMessagesPerWindow, WS_LIMITS.windowMs)) return { ok: false, error: "RATE_LIMITED" };
    const message = typeof raw === "object" && raw !== null ? (raw as { topic?: unknown; payload?: unknown }) : {};
    const topic = TopicSchema.safeParse(message.topic);
    if (!topic.success) return { ok: false, error: "INVALID_TOPIC" };
    if (!canPublish(topic.data, actor)) return { ok: false, error: "FORBIDDEN" };
    if (Buffer.byteLength(JSON.stringify(message.payload ?? null), "utf8") > WS_LIMITS.maxPayloadBytes) return { ok: false, error: "PAYLOAD_TOO_LARGE" };
    publish(this.namespace(), topic.data, message.payload ?? null, socket.id);
    return { ok: true };
  }

  // presence => suscriptores actuales del tópico (tamaño de la room; O(1) en el adaptador en memoria)
  private presence(topic: string): number {
    return this.namespace().adapter.rooms.get(topicRoom(topic))?.size ?? 0;
  }

  // reply => ejecuta la acción y responde por el ack solo si el cliente lo pidió
  private reply(ack: Ack | undefined, action: () => { ok: boolean; error?: string; subscribers?: number }): void {
    const result = action();
    if (typeof ack === "function") ack(result);
  }

  private namespace(): Namespace {
    if (!this.nsp) throw new ServiceUnavailableException("WebSocket Gateway no inicializado");
    return this.nsp;
  }
}

export const websocketGatewayService = new WebsocketGatewayService();
