// realtime_analytic.handler.ts (Express + Socket.io) => entrada de la analítica de alta frecuencia (sprint 9.1).
// - REST /api/v1/rt/analytic: registrar evento (público con rate limit), métricas y purga del buffer (ADMIN).
// - Socket.io namespace "/rt/analytic" (ruta lógica /ws/v1/rt/analytic/stream), SOLO administradores: recibe
//   "metric:kpi" agrupado cada 100 ms como máximo, solo si hubo actividad y hay alguien conectado (cero trabajo en
//   reposo) y "metric:alert" ante un pico de tráfico. Patrón Observer + Throttle.
import { Router, type Request, type Response } from "express";
import type { Server } from "socket.io";
import { realtimeAnalyticService, SPIKE_EVENTS_PER_MINUTE } from "../service/realtime_analytic.service";
import { CreateEventRequestSchema, MetricQuerySchema } from "../dto/realtime_analytic.dto";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { authenticateSocket } from "../../../config/socket.config";
import { optionalAuth } from "../../../shared/middleware/jwt.middleware";
import { rateLimit } from "../../../shared/middleware/rate-limit.middleware";
import { Roles } from "../../../shared/constants/roles.constants";
import { HttpStatus } from "../../../shared/constants/http.constants";
import { isAdmin } from "../../../shared/decorator/auth.decorator";
import { sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import type { AuthenticatedRequestUser } from "../../auth/types/auth.types";

const NAMESPACE = "/rt/analytic";
const PUSH_THROTTLE_MS = 100; // Objetivo de la matriz: push < 100 ms

export const realtimeAnalyticRouter = Router();

// POST /api/v1/rt/analytic/event => createAnalyticEvent() — 120 eventos por minuto e IP (anti-abuso)
// Handler síncrono: record() no hace E/S (la escritura a MongoDB va por lotes); un throw llega al error.middleware
realtimeAnalyticRouter.post("/event", rateLimit({ bucket: "rt-analytic", limit: 120, windowSeconds: 60 }), optionalAuth, (req: Request, res: Response) => {
  sendSuccess(res, realtimeAnalyticService.record(CreateEventRequestSchema.parse(req.body), req.user?.id ?? null), HttpStatus.ACCEPTED);
});

// GET /api/v1/rt/analytic/metric => listMetricAggregates() — ADMIN
realtimeAnalyticRouter.get("/metric", jwtAuthGuard, requireRoles(Roles.ADMIN), (req: Request, res: Response) => {
  sendSuccess(res, realtimeAnalyticService.metrics(MetricQuerySchema.parse(req.query)));
});

// DELETE /api/v1/rt/analytic/event-buffer => deleteAllAnalyticEvents() — ADMIN
realtimeAnalyticRouter.delete("/event-buffer", jwtAuthGuard, requireRoles(Roles.ADMIN), (_req: Request, res: Response) => {
  sendSuccess(res, realtimeAnalyticService.purgeExpired());
});

// registerRealtimeAnalyticGateway => namespace Socket.io de métricas en vivo (bootstrap, una vez)
export function registerRealtimeAnalyticGateway(io: Server): void {
  const nsp = io.of(NAMESPACE);
  nsp.use(authenticateSocket);
  // Segundo middleware del handshake: solo administradores (métricas de negocio)
  nsp.use((socket, next) => {
    const user = socket.data["user"] as AuthenticatedRequestUser | undefined;
    next(user && isAdmin(user) ? undefined : new Error("FORBIDDEN"));
  });
  // Al conectar se envía la foto actual (el panel no espera al próximo evento)
  nsp.on("connection", (socket) => socket.emit("metric:kpi", realtimeAnalyticService.kpis()));

  let timer: NodeJS.Timeout | null = null;
  realtimeAnalyticService.onActivity(() => {
    if (nsp.sockets.size === 0) return; // Nadie mirando => no se calcula nada (ahorro de CPU)
    timer ??= setTimeout(() => {
      timer = null;
      const snapshot = realtimeAnalyticService.kpis();
      nsp.emit("metric:kpi", snapshot);
      if (snapshot.eventsPerMinute >= SPIKE_EVENTS_PER_MINUTE) nsp.emit("metric:alert", { kind: "traffic_spike", eventsPerMinute: snapshot.eventsPerMinute });
    }, PUSH_THROTTLE_MS);
  });
}
