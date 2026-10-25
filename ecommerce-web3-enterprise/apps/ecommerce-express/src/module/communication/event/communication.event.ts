// communication.event.ts (Socket.io) => GATEWAY de tiempo real: traduce eventos de Socket.io en casos de uso y reenvía
// los eventos de dominio (bus en memoria) a las salas correctas. Patrón Observer + Mediator; se registra UNA vez.
// Salas: "conversation:<id>" (cliente y agente de esa conversación), "agents" (administradores) y "social:feed"
// (visitantes del feed social, incluso anónimos: solo reciben avisos públicos de nuevas publicaciones).
import type { Server, Socket } from "socket.io";
import { ZodError } from "zod";
import { communicationEvents, communicationService } from "../service/communication.service";
import { JoinSchema, MessageSchema } from "../schema/communication.schema";
import { socialEvents } from "../../social-commerce/service/social.service";
import type { AuthenticatedRequestUser } from "../../auth/types/auth.types";
import { consumeRateLimit } from "../../../shared/middleware/rate-limit.middleware";
import { AppException, TooManyRequestsException } from "../../../shared/filter/http-exception.filter";
import { isAdmin } from "../../../shared/decorator/auth.decorator";
import { parseLocale } from "../../../shared/util/i18n.util";

const room = (conversationId: string) => `conversation:${conversationId}`;
const CHAT_LIMIT = { bucket: "chat-message", limit: 20, windowSeconds: 60 }; // Anti-spam: 20 mensajes/min por usuario

// Ack => respuesta al "callback" del cliente: { ok } o { ok:false, code } (mismo vocabulario de códigos que REST)
type Ack = (response: { ok: true } | { ok: false; code: string }) => void;

// guarded => envuelve un handler: exige usuario, valida y traduce errores a un "ack" (DRY entre eventos)
function guarded(socket: Socket, handler: (user: AuthenticatedRequestUser, payload: unknown) => Promise<void>) {
  return (payload: unknown, ack?: Ack) => {
    const user = socket.data["user"] as AuthenticatedRequestUser | undefined;
    const reply: Ack = typeof ack === "function" ? ack : () => undefined; // El cliente puede no pedir confirmación
    if (!user) return reply({ ok: false, code: "UNAUTHORIZED" });
    handler(user, payload)
      .then(() => reply({ ok: true }))
      .catch((error: unknown) => {
        const code = error instanceof AppException ? error.code : error instanceof ZodError ? "VALIDATION_ERROR" : "INTERNAL_ERROR";
        reply({ ok: false, code });
      });
  };
}

export function registerCommunicationGateway(io: Server): void {
  io.on("connection", (socket) => {
    const user = socket.data["user"] as AuthenticatedRequestUser | undefined;
    if (user && isAdmin(user)) void socket.join("agents"); // Los administradores atienden los escalados

    // Feed social en vivo (público): el cliente se suscribe solo mientras ve el feed
    socket.on("feed:subscribe", () => void socket.join("social:feed"));
    socket.on("feed:unsubscribe", () => void socket.leave("social:feed"));
    // RF-19.9 espectadores de un Live Shopping (público; el id es un ObjectId de 24 hex)
    socket.on("live:join", (liveId: unknown) => typeof liveId === "string" && /^[a-f0-9]{24}$/i.test(liveId) && void socket.join(`live:${liveId}`));

    // chat:join => entra a la sala de una conversación propia (o cualquiera, si es agente)
    socket.on(
      "chat:join",
      guarded(socket, async (viewer, payload) => {
        const { conversationId } = JoinSchema.parse(payload);
        await communicationService.assertAccess(conversationId, viewer);
        await socket.join(room(conversationId));
      })
    );

    // chat:message => mensaje nuevo (cliente o agente); el idioma del bot sale del navegador del cliente
    socket.on(
      "chat:message",
      guarded(socket, async (viewer, payload) => {
        const { conversationId, content } = MessageSchema.parse(payload);
        const count = await consumeRateLimit(CHAT_LIMIT, viewer.id);
        if (count !== null && count > CHAT_LIMIT.limit) throw new TooManyRequestsException();
        await communicationService.postMessage(conversationId, content, viewer, parseLocale(socket.handshake.headers["accept-language"]));
      })
    );
  });

  // --- Eventos de dominio -> salas (Observer) ---
  communicationEvents.on("conversation.message", ({ conversationId, message }) => {
    io.to(room(conversationId)).emit("chat:message", { conversationId, message });
  });
  communicationEvents.on("conversation.token", ({ conversationId, token }) => {
    io.to(room(conversationId)).emit("chat:token", { conversationId, token });
  });
  communicationEvents.on("conversation.escalated", (event) => {
    io.to(room(event.conversationId)).to("agents").emit("chat:escalated", event); // Cliente y agentes a la vez
  });
  socialEvents.on("social.published", ({ postId }) => {
    io.to("social:feed").emit("social:published", { postId }); // Solo el ID: el cliente refresca su caché de TanStack Query
  });
  // RF-19.9 producto fijado / estado del live => a los espectadores de esa transmisión (sala "live:<id>")
  socialEvents.on("live.updated", (event) => {
    io.to(`live:${event.liveId}`).emit("live:updated", event);
  });
}

