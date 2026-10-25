// websocket_gateway.handler.ts (Express + Socket.io) => entrada de la pasarela WebSocket (sprint 9.3).
// - Socket.io namespace "/rt/gateway" (ruta lógica /ws/v1/rt/gateway/connect): SOLO conexiones autenticadas con JWT.
//   Reutiliza el Socket.io que ya corre en Express (mismo puerto y misma ruta /ws/socket.io): sin otro servidor.
// - REST /api/v1/rt/ws/connection (ADMIN): listar, ver y cerrar conexiones activas.
// Patrón Observer (eventos del socket) + Thin Controller.
import { Router, type Request, type Response } from "express";
import type { Server } from "socket.io";
import { z } from "zod";
import { websocketGatewayService } from "../service/websocket_gateway.service";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { authenticateSocket } from "../../../config/socket.config";
import { Roles } from "../../../shared/constants/roles.constants";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import type { AuthenticatedRequestUser } from "../../auth/types/auth.types";

const NAMESPACE = "/rt/gateway";
const socketIdParam = (req: Request) => z.string().regex(/^[\w-]{10,40}$/).parse(req.params["id"]); // socket.id de Socket.io

export const websocketGatewayRouter = Router();
websocketGatewayRouter.use(jwtAuthGuard, requireRoles(Roles.ADMIN));

// GET /api/v1/rt/ws/connection => listWsConnections()
websocketGatewayRouter.get(
  "/connection",
  asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, websocketGatewayService.list());
  })
);

// GET /api/v1/rt/ws/connection/:id => getWsConnectionById()
websocketGatewayRouter.get(
  "/connection/:id",
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, websocketGatewayService.get(socketIdParam(req)));
  })
);

// DELETE /api/v1/rt/ws/connection/:id => deleteWsConnectionById() (cierre ordenado)
websocketGatewayRouter.delete(
  "/connection/:id",
  asyncHandler(async (req: Request, res: Response) => {
    websocketGatewayService.close(socketIdParam(req));
    sendNoContent(res);
  })
);

// registerWebsocketGateway => namespace autenticado (bootstrap, una vez)
export function registerWebsocketGateway(io: Server): void {
  const nsp = io.of(NAMESPACE);
  nsp.use(authenticateSocket);
  // Sin usuario => rechazo en el handshake (la pasarela no admite anónimos)
  nsp.use((socket, next) => next(socket.data["user"] ? undefined : new Error("UNAUTHORIZED")));
  websocketGatewayService.attach(nsp);
  nsp.on("connection", (socket) => websocketGatewayService.connect(socket, socket.data["user"] as AuthenticatedRequestUser));
}
