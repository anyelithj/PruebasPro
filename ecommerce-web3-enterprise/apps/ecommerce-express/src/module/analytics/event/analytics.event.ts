// analytics.event.ts => eventos de analítica + GATEWAY de métricas en tiempo real (Socket.io) para el panel admin.
// Patrón Observer: el tracking y las órdenes publican; el gateway acumula y emite a la sala "admin:live".
// Ahorro de energía y red: los avisos se agrupan (throttle) y se emiten como máximo cada 5 s, SOLO si hubo actividad
// (no hay timer corriendo en reposo) y SOLO a administradores conectados. El panel refresca sus KPIs al recibirlos.
import type { Server } from "socket.io";
import { TypedEventBus } from "../../../shared/util/event-bus.util";
import { commerceEvents } from "../../order/event/order.event";
import { inventoryEvents } from "../../inventory/event/inventory.event";
import { isAdmin } from "../../../shared/decorator/auth.decorator";
import type { AuthenticatedRequestUser } from "../../auth/types/auth.types";

export type AnalyticsEvents = {
  "analytics.tracked": { count: number };
  "metric.alert": { ruleId: string; name: string; metric: string; value: number; threshold: number }; // RF-24.10
};

// Bus de analítica (Singleton de módulo)
export const analyticsEvents = new TypedEventBus<AnalyticsEvents>("analytics");

const ROOM = "admin:live";
const FLUSH_MS = 5_000;

// LiveTick => lo que recibe el panel: actividad acumulada desde el último aviso
interface LiveTick {
  events: number;
  orders: number;
  revenueCents: number;
  lowStock: number;
}

export function registerAnalyticsGateway(io: Server): void {
  let tick: LiveTick = { events: 0, orders: 0, revenueCents: 0, lowStock: 0 };
  let timer: NodeJS.Timeout | null = null;

  // schedule => "??=" programa UN envío por ventana; al emitir, el acumulado vuelve a cero
  const schedule = () => {
    timer ??= setTimeout(() => {
      timer = null;
      io.to(ROOM).emit("analytics:tick", { ...tick, at: new Date().toISOString() });
      tick = { events: 0, orders: 0, revenueCents: 0, lowStock: 0 };
    }, FLUSH_MS);
  };

  io.on("connection", (socket) => {
    const user = socket.data["user"] as AuthenticatedRequestUser | undefined;
    // Solo administradores pueden suscribirse a las métricas en vivo (y solo mientras el panel está abierto)
    socket.on("analytics:subscribe", () => {
      if (user && isAdmin(user)) void socket.join(ROOM);
    });
    socket.on("analytics:unsubscribe", () => void socket.leave(ROOM));
  });

  analyticsEvents.on("analytics.tracked", ({ count }) => {
    tick.events += count;
    schedule();
  });
  commerceEvents.on("order.placed", ({ totalCents }) => {
    tick.orders += 1;
    tick.revenueCents += totalCents;
    schedule();
  });
  // RF-24.10 alerta de métrica crítica: se emite al instante (no espera la ventana de 5 s)
  analyticsEvents.on("metric.alert", (alert) => {
    io.to(ROOM).emit("analytics:alert", { ...alert, at: new Date().toISOString() });
  });
  inventoryEvents.on("inventory.low", () => {
    tick.lowStock += 1;
    schedule();
  });
}
