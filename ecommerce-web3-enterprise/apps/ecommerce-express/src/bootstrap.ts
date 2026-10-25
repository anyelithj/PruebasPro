// bootstrap.ts => Composition Root de la aplicación: conecta bases de datos, crea el servidor HTTP + WebSocket,
// registra los suscriptores de eventos de dominio, agenda los jobs y maneja el apagado ordenado.
// Lo carga server.ts DESPUÉS de resolver los secretos (Key Vault opcional o .env), porque app.config valida el
// entorno en cuanto se importa.
import { createServer } from "node:http";
import { createApp } from "./app";
import { appConfig } from "./config/app.config";
import { connectMongo, disconnectDatabases } from "./config/database.config";
import { redis } from "./config/redis.config";
import { initSocket } from "./config/socket.config";
import { attachGraphqlSubscriptions } from "./config/graphql.config";
import { logger } from "./shared/middleware/logger.middleware";
import { shippingService } from "./module/shipping/service/shipping.service";
import { paymentService } from "./module/payment/service/payment.service";
import { invoiceService } from "./module/invoice/service/invoice.service";
import { loyaltyService } from "./module/loyalty/service/loyalty.service";
import { checkoutService } from "./module/checkout/service/checkout.service";
import { cartService } from "./module/cart/service/cart.service";
import { promotionService } from "./module/coupon/service/promotion.service";
import { reviewService } from "./module/review/service/review.service";
import { registerNotificationSubscribers } from "./module/notification/event/notification.event";
import { automationService } from "./module/automation/service/automation.service";
import { socialService } from "./module/social-commerce/service/social.service";
import { registerCommunicationGateway } from "./module/communication/event/communication.event";
import { setAuditSink } from "./shared/middleware/logger.middleware";
import { auditService } from "./module/audit-log/service/audit.service";
import { registerInventorySubscribers } from "./module/inventory/event/inventory.event";
import { webhookDispatcher } from "./module/webhook/handler/webhook.handler";
import { registerAnalyticsGateway } from "./module/analytics/event/analytics.event";
import { marketingService } from "./module/marketing/service/marketing.service";
import { realtimeInventoryService, registerRealtimeInventoryGateway } from "./module/realtime_inventory";
import { realtimeAnalyticService, registerRealtimeAnalyticGateway } from "./module/realtime_analytic";
import { registerWebsocketGateway } from "./module/websocket_gateway/handler/websocket_gateway.handler";
import { cacheService } from "./module/cache";
import { emailService } from "./module/email/service/email.service";
import { retentionService } from "./module/crm/service/retention.service"; // RF-16.3 / RF-18.8 / RF-20.8
import { channelService } from "./module/social-commerce/service/channel.service"; // RF-19.1 / 19.7 / 19.10
import { purchaseOrderService } from "./module/supplier/service/purchase-order.service"; // RF-23.8
import { advancedAnalyticsService } from "./module/analytics/service/advanced.service"; // RF-24.10
import { mediaOpsService } from "./module/media/service/media-ops.service"; // RF-26.4
import { proofNftService } from "./module/order/service/proof-nft.service"; // RF-29.3
import { auditInsightService, registerAuditGateway } from "./module/audit-log/service/audit-insight.service"; // RF-30.4 / 30.8

const ONE_MINUTE_MS = 60_000;
const ONE_DAY_MS = 24 * 60 * ONE_MINUTE_MS;

// registerDomainSubscribers => cada módulo registra sus reacciones a eventos (Observer); UNA sola vez por proceso
function registerDomainSubscribers(): void {
  shippingService.registerSubscribers(); // order.placed / order.cancelled => envío
  paymentService.registerSubscribers(); // order.cancelled => reembolso automático
  invoiceService.registerSubscribers(); // order.placed => factura; refund.updated => nota crédito
  loyaltyService.registerSubscribers(); // order entregado => puntos; devolución => ajuste; bienvenida y reseñas (RF-14)
  promotionService.registerSubscribers(); // order.placed => historial de promociones aplicadas (RF-13.10)
  registerNotificationSubscribers(); // Todos los eventos => notificaciones/correos
  emailService.registerSubscribers(); // RF-21.5 conversiones atribuidas al último clic de campaña
  automationService.registerSubscribers(); // Eventos de comercio => flujos n8n suscritos
  // Fase 7
  registerInventorySubscribers(); // Stock cambiado => caché del catálogo; stock bajo => aviso a administradores
  webhookDispatcher.registerSubscribers(); // Eventos de comercio e inventario => webhooks externos firmados
  auditService.registerSubscribers(); // Eventos sensibles => audit trail
  setAuditSink(auditService.recordRequest); // Cada escritura autenticada de la API => audit trail
  channelService.registerSubscribers(); // RF-19.10 stock único => inventario en Meta y TikTok Shop
  proofNftService.registerSubscribers(); // RF-29.3 NFT de prueba de compra al entregar
}

// scheduleJobs => tareas periódicas en proceso. Con varias réplicas se moverían a BullMQ (prescrito en el SETUP)
// para que las ejecute un solo worker; las consultas ya son idempotentes (seguras si dos réplicas coinciden).
function scheduleJobs(): NodeJS.Timeout[] {
  const run = (name: string, job: () => Promise<unknown>) => () => {
    job().catch((error: unknown) => logger.error("job_failed", { job: name, error }));
  };
  return [
    setInterval(run("expire-checkouts", () => checkoutService.expireStaleSessions()), ONE_MINUTE_MS), // Libera stock reservado vencido
    setInterval(run("purge-points", () => loyaltyService.purgeExpiredPoints()), ONE_DAY_MS), // Vencimiento de puntos
    setInterval(run("abandoned-carts", () => cartService.remindAbandoned()), 15 * ONE_MINUTE_MS), // RF-07.6 recordatorios
    setInterval(run("review-requests", () => reviewService.requestReviews()), 60 * ONE_MINUTE_MS), // RF-15.8 pedir reseña
    setInterval(run("birthdays", () => loyaltyService.birthdays()), ONE_DAY_MS), // RF-13.3 / RF-14.1 cumpleaños
    setInterval(run("points-expiring", () => loyaltyService.expiringReminders()), ONE_DAY_MS), // RF-14.7 recordatorio
    // RF-13.9 desde noviembre se preconfiguran Black Friday y Cyber Monday del año (idempotente)
    setInterval(run("seasonal-campaigns", async () => (new Date().getMonth() >= 10 ? promotionService.ensureSeasonalCampaigns() : 0)), ONE_DAY_MS),
    setInterval(run("shipment-delays", () => shippingService.notifyDelayed()), 60 * ONE_MINUTE_MS), // RF-09.6 retrasos
    setInterval(run("media-backup", () => mediaOpsService.backup()), ONE_DAY_MS), // RF-26.4 respaldo incremental diario
    setInterval(run("audit-anomalies", () => auditInsightService.scanAnomalies()), 10 * ONE_MINUTE_MS), // RF-30.4 anomalías
    setInterval(run("metric-alerts", () => advancedAnalyticsService.evaluateAlerts()), 5 * ONE_MINUTE_MS), // RF-24.10 métricas críticas
    setInterval(run("supplier-payments-due", () => purchaseOrderService.dueAlerts()), ONE_DAY_MS), // RF-23.8 pagos por vencer
    setInterval(run("customer-reactivation", () => retentionService.reactivate()), ONE_DAY_MS), // RF-18.8 / RF-20.8 inactivos
    setInterval(run("personalized-offers", () => retentionService.personalizedOffers()), ONE_DAY_MS), // RF-16.3 (1 por cliente/semana)
    setInterval(run("social-scheduled", () => socialService.publishDueScheduled()), ONE_MINUTE_MS), // Publicaciones programadas
    setInterval(run("catalog-sync", () => channelService.syncCatalog()), 60 * ONE_MINUTE_MS), // RF-19.1 / 19.7 precios y fichas
    setInterval(run("marketing-scheduled", () => marketingService.dispatchDue()), ONE_MINUTE_MS), // Campañas programadas
    // Fase 9
    setInterval(run("rt-release-reservations", () => realtimeInventoryService.releaseExpired()), ONE_MINUTE_MS), // Carritos abandonados
    setInterval(run("rt-cache-purge", async () => cacheService.purgeExpired()), 5 * ONE_MINUTE_MS), // Libera RAM de la caché L1
  ];
}

export async function bootstrap(): Promise<void> {
  // MongoDB (notificaciones, historial): si no conecta, la API sigue sirviendo el resto (degradación parcial)
  await connectMongo().catch((error: unknown) => logger.error("mongo_unavailable", { error }));
  await redis.connect().catch(() => logger.warn("redis_unavailable_starting_without_cache"));

  const app = await createApp();
  const server = createServer(app); // Servidor HTTP compartido por Express, GraphQL WebSocket y Socket.io (mismo puerto)
  attachGraphqlSubscriptions(server); // GraphQL Subscriptions (graphql-ws) en /graphql
  const io = initSocket(server); // Socket.io en /ws/socket.io (un solo servidor para todos los gateways)
  registerCommunicationGateway(io); // Chat de Communication + feed social
  registerAnalyticsGateway(io); // Métricas en vivo del panel admin (sala "admin:live")
  // Fase 9: namespaces Socket.io en el MISMO servidor (sin puertos ni contenedores extra)
  registerRealtimeInventoryGateway(io); // /rt/inventory — stock en tiempo real por variante
  registerRealtimeAnalyticGateway(io); // /rt/analytic — KPIs en vivo (solo ADMIN)
  registerWebsocketGateway(io); // /rt/gateway — Pub/Sub por tópico autenticado
  registerAuditGateway(io); // RF-30.8 sala "admin:audit": registro de auditoría en tiempo real
  registerDomainSubscribers();
  const timers = scheduleJobs();

  server.listen(appConfig.PORT, () => {
    // Template literal con interpolación: confirma en consola que el servidor arrancó y en qué puerto
    logger.info(`Express API (Fases 1-9) escuchando en http://localhost:${appConfig.PORT}`);
  });

  // Graceful shutdown: Docker/Kubernetes envían SIGTERM; se deja de aceptar conexiones y se cierran recursos
  const shutdown = (signal: string) => {
    logger.info("shutdown_started", { signal });
    timers.forEach(clearInterval);
    void auditService.flush(); // Escribe el lote pendiente del audit trail antes de cerrar
    void realtimeAnalyticService.flush(); // Igual con el lote pendiente de eventos de analítica en tiempo real
    server.close(() => {
      Promise.all([disconnectDatabases(), redis.quit().catch(() => undefined)])
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    });
    setTimeout(() => process.exit(1), 10_000).unref(); // Si algo se cuelga, se fuerza la salida a los 10 s
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
