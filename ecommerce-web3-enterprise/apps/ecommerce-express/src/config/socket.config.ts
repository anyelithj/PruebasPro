// socket.config.ts (Socket.io) => canal de tiempo real para el chat de Communication y el feed social (sprint 6.1).
// Los eventos de cada sala los registra el gateway communication.event.ts (bootstrap).
// Las notificaciones in-app ya NO viajan por aquí: usan GraphQL Subscriptions (graphql.config.ts).
// Autenticación en el handshake con el MISMO access token JWT de la API; cada usuario entra a su sala privada
// "user:<id>" => el servidor emite solo al destinatario (nunca broadcast de datos personales).
import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { appConfig } from "./app.config";
import { resolveAccessToken } from "../module/auth/strategy/jwt.strategy";
import { logger } from "../shared/middleware/logger.middleware";

export function initSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: "/ws/socket.io",
    cors: { origin: appConfig.CORS_ORIGINS, credentials: true },
  });

  // Middleware de handshake: se ejecuta UNA vez por conexión (no por mensaje).
  // Sin token => conexión ANÓNIMA (solo puede suscribirse al feed social público); token inválido => rechazo.
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const user = socket.data["user"] as { id: string } | undefined;
    if (user) void socket.join(`user:${user.id}`); // Sala privada del usuario
    logger.debug("socket_connected", { userId: user?.id ?? "anonymous" });
  });

  return io;
}

// authenticateSocket => middleware de handshake REUTILIZABLE (DRY): "io.use" solo protege el namespace "/";
// cada namespace de la Fase 9 (/rt/inventory, /rt/analytic, /rt/gateway) lo registra con "nsp.use(authenticateSocket)".
// Sin token => anónimo; token inválido => rechazo; token válido => "socket.data.user" (id + roles).
export function authenticateSocket(socket: Socket, next: (error?: Error) => void): void {
  // El cliente envía el token en "auth" (no en la URL: las URLs quedan en logs de proxies)
  const token = typeof socket.handshake.auth["token"] === "string" ? socket.handshake.auth["token"] : "";
  if (!token) return next();
  resolveAccessToken(token)
    .then((user) => {
      if (!user) return next(new Error("UNAUTHORIZED"));
      socket.data["user"] = user; // "socket.data" => estado por conexión (id + roles para los gateways)
      next();
    })
    .catch(() => next(new Error("UNAUTHORIZED")));
}
