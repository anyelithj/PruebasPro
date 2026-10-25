// inventory.handler.ts (Express + Socket.io) => capa de entrada del inventario en tiempo real (sprint 9.1).
// - REST /api/v1/rt/inventory: lectura pública de stock (< 10 ms), reemplazo de stock (ADMIN) y reservas (usuario).
// - Socket.io namespace "/rt/inventory" (ruta lógica /ws/v1/rt/inventory/stream): el cliente se suscribe a variantes
//   y recibe "inventory:stock" solo de esas salas (difusión dirigida: sin broadcast global, menos red y CPU).
// Patrón Observer (el service avisa, el gateway difunde) + Thin Controller (valida con Zod y delega).
import { performance } from "node:perf_hooks";
import { Router, type Request, type Response } from "express";
import type { Server } from "socket.io";
import { realtimeInventoryService } from "../service/inventory.service";
import { ReservationRequestSchema, StockRequestSchema, SubscribeSchema } from "../dto/inventory.dto";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { authenticateSocket } from "../../../config/socket.config";
import { Roles } from "../../../shared/constants/roles.constants";
import { HttpStatus } from "../../../shared/constants/http.constants";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId } from "../../../shared/pipe/validation.pipe";

const NAMESPACE = "/rt/inventory";
const room = (variantId: string) => `variant:${variantId}`; // Una sala por variante

export const realtimeInventoryRouter = Router();

// POST /api/v1/rt/inventory/reservation => createStockReservation()
realtimeInventoryRouter.post(
  "/reservation",
  jwtAuthGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const reservation = await realtimeInventoryService.reserve(ReservationRequestSchema.parse(req.body), currentUser(req).id);
    sendSuccess(res, reservation, HttpStatus.CREATED);
  })
);

// DELETE /api/v1/rt/inventory/reservation/:id => deleteStockReservationById()
realtimeInventoryRouter.delete(
  "/reservation/:id",
  jwtAuthGuard,
  asyncHandler(async (req: Request, res: Response) => {
    await realtimeInventoryService.release(parseId(req), currentUser(req));
    sendNoContent(res);
  })
);

// GET /api/v1/rt/inventory/:id => getInventoryEntryById() — público (la tienda muestra disponibilidad)
realtimeInventoryRouter.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const started = performance.now(); // Reloj monotónico de alta resolución (no cambia con la hora del sistema)
    const stock = await realtimeInventoryService.getStock(parseId(req));
    // "Server-Timing" (estándar W3C) => el navegador y k6 ven la latencia interna para verificar el objetivo < 10 ms
    res.setHeader("Server-Timing", `app;dur=${(performance.now() - started).toFixed(2)}`);
    sendSuccess(res, stock);
  })
);

// PUT /api/v1/rt/inventory/:id/stock => updateInventoryEntry() — solo ADMIN
realtimeInventoryRouter.put(
  "/:id/stock",
  jwtAuthGuard,
  requireRoles(Roles.ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await realtimeInventoryService.replaceStock(parseId(req), StockRequestSchema.parse(req.body), currentUser(req).id));
  })
);

// registerRealtimeInventoryGateway => namespace Socket.io + puente Observer service -> salas (bootstrap, una vez)
export function registerRealtimeInventoryGateway(io: Server): void {
  const nsp = io.of(NAMESPACE);
  nsp.use(authenticateSocket); // Anónimos permitidos (stock público); token inválido => rechazo

  nsp.on("connection", (socket) => {
    // "inventory:subscribe" => [variantIds]; el "ack" devuelve la foto actual para pintar sin esperar un cambio
    socket.on("inventory:subscribe", (payload: unknown, ack?: unknown) => {
      const parsed = SubscribeSchema.safeParse(payload);
      if (!parsed.success) return;
      parsed.data.forEach((variantId) => void socket.join(room(variantId)));
      if (typeof ack !== "function") return;
      // "allSettled" => una variante inexistente no impide responder las demás
      void Promise.allSettled(parsed.data.map((variantId) => realtimeInventoryService.getStock(variantId))).then((results) =>
        ack(results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])))
      );
    });
    socket.on("inventory:unsubscribe", (payload: unknown) => {
      const parsed = SubscribeSchema.safeParse(payload);
      if (parsed.success) parsed.data.forEach((variantId) => void socket.leave(room(variantId)));
    });
  });

  realtimeInventoryService.registerSubscribers();
  realtimeInventoryService.onChange((stock) => {
    nsp.to(room(stock.variantId)).emit("inventory:stock", stock);
    // Alerta de stock crítico en la misma sala (el panel admin se suscribe a las variantes que vigila)
    if (stock.low) nsp.to(room(stock.variantId)).emit("inventory:alert", { variantId: stock.variantId, sku: stock.sku, available: stock.available });
  });
}
