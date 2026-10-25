// app.ts => configura la instancia de Express (middlewares globales + montaje de rutas).
// Se separa de "server.ts" (que crea el servidor HTTP) para poder importar "app" en los tests
// de integración con Supertest SIN levantar un servidor real (más rápido, sin puertos ocupados).
import express, { type Express, type Request, type Response } from "express";
import helmet from "helmet"; // Middleware que setea headers HTTP de seguridad (XSS, clickjacking, etc.)
import passport from "passport";
import { configurePassport } from "./config/passport.config";
import { createGraphqlHandler, GRAPHQL_PATH } from "./config/graphql.config";
import { mountSwagger, type ApiModule } from "./config/swagger.config";
import { isProduction } from "./config/app.config";
import { prisma } from "./config/database.config";
import { corsMiddleware } from "./shared/middleware/cors.middleware";
import { requestLogger } from "./shared/middleware/logger.middleware";
import { optionalAuth } from "./shared/middleware/jwt.middleware";
import { errorMiddleware } from "./shared/middleware/error.middleware";
// --- Routers por módulo (cada Router es independiente: SRP a nivel de módulo) ---
import { authRouter } from "./module/auth/route/auth.route";
import { userRouter } from "./module/user/route/user.route";
import { roleRouter } from "./module/role/route/role.route";
import { permissionRouter } from "./module/permission/route/permission.route";
import { productRouter } from "./module/product/route/product.route";
import { categoryRouter } from "./module/category/route/category.route";
import { brandRouter } from "./module/brand/route/brand.route";
import { collectionRouter } from "./module/collection/route/collection.route";
import { mediaRouter } from "./module/media/route/media.route";
import { cartRouter } from "./module/cart/route/cart.route";
import { searchRouter } from "./module/search/route/search.route";
import { checkoutRouter } from "./module/checkout/route/checkout.route";
import { orderRouter } from "./module/order/route/order.route";
import { paymentRouter, paymentWebhookRouter } from "./module/payment/route/payment.route";
import { shippingRouter } from "./module/shipping/route/shipping.route";
import { invoiceRouter } from "./module/invoice/route/invoice.route";
import { refundRouter } from "./module/refund/route/refund.route";
import { couponRouter } from "./module/coupon/route/coupon.route";
import { promotionRouter } from "./module/coupon/route/promotion.route"; // RF-13 promociones automáticas
import { loyaltyRouter } from "./module/loyalty/route/loyalty.route";
import { reviewRouter } from "./module/review/route/review.route";
import { notificationRouter } from "./module/notification/route/notification.route";
import { idempotency } from "./shared/middleware/idempotency.middleware";
import { channelWebhookRouter, socialRouter } from "./module/social-commerce/route/social.route";
import { automationRouter } from "./module/automation/route/automation.route";
import { communicationRouter } from "./module/communication/route/communication.route";
import { recommendationRouter } from "./module/recommendation/route/recommendation.route";
import { graphRouter } from "./module/graph-analysis/route/graph.route";
import { analyticsRouter } from "./module/analytics/route/analytics.route";
import { dashboardRouter } from "./module/dashboard/route/dashboard.route";
import { inventoryRouter } from "./module/inventory/route/inventory.route";
import { supplierRouter } from "./module/supplier/route/supplier.route";
import { emailRouter } from "./module/email/route/email.route";
import { webhookRouter } from "./module/webhook/route/webhook.route";
import { mcpRouter } from "./module/mcp-server/route/mcp.route";
import { marketingRouter } from "./module/marketing/route/marketing.route";
import { crmRouter } from "./module/crm/route/crm.route";
import { auditRouter } from "./module/audit-log/route/audit.route";
import { cmsRouter } from "./module/cms/route/cms.route";
// Fase 9 en Express (reemplazo temporal de Rust): mismos módulos, archivos y rutas con el segmento "rt"
import { realtimeInventoryRouter } from "./module/realtime_inventory";
import { realtimeAnalyticRouter } from "./module/realtime_analytic";
import { blockchainRouter } from "./module/blockchain";
import { gatewayRouter } from "./module/gateway";
import { websocketGatewayRouter } from "./module/websocket_gateway/handler/websocket_gateway.handler";
import { cacheRouter } from "./module/cache";

const API_PREFIX = "/api/v1"; // Versionado por URL: /api/v2 convivirá sin romper clientes existentes

// API_MODULES => registro [segmento, router] de todos los módulos REST ("as const" + readonly: inmutable)
const API_MODULES: readonly ApiModule[] = [
  ["auth", authRouter],
  ["user", userRouter],
  ["role", roleRouter],
  ["permission", permissionRouter],
  ["product", productRouter],
  ["category", categoryRouter],
  ["brand", brandRouter],
  ["collection", collectionRouter],
  ["media", mediaRouter],
  ["cart", cartRouter],
  ["search", searchRouter],
  ["checkout", checkoutRouter],
  ["order", orderRouter],
  ["payment", paymentRouter],
  ["shipping", shippingRouter],
  ["invoice", invoiceRouter],
  ["refund", refundRouter],
  ["coupon", couponRouter],
  ["promotion", promotionRouter],
  ["loyalty", loyaltyRouter],
  ["review", reviewRouter],
  ["notification", notificationRouter],
  // Fase 6 — Social, Automation & AI
  ["social", socialRouter],
  ["automation", automationRouter],
  ["communication", communicationRouter],
  ["recommendation", recommendationRouter],
  ["product-graph", graphRouter],
  // Fase 7 — Analytics, Admin & Integrations
  ["analytic", analyticsRouter],
  ["dashboard", dashboardRouter],
  ["inventory", inventoryRouter],
  ["supplier", supplierRouter],
  ["email", emailRouter],
  ["webhook", webhookRouter],
  ["mcp", mcpRouter],
  ["marketing", marketingRouter],
  ["crm", crmRouter],
  ["audit", auditRouter],
  // Fase 8 — CMS que administra Nuxt (páginas, landings, lookbooks, eventos, leads y configuración de tienda)
  ["cms", cmsRouter],
  // Fase 9 — High Performance & Edge Gateway en Express (/api/v1/rt/*; volver a Rust = cambiar "rt" por "rs")
  ["rt/inventory", realtimeInventoryRouter],
  ["rt/analytic", realtimeAnalyticRouter],
  ["rt/blockchain", blockchainRouter],
  ["rt/gateway", gatewayRouter],
  ["rt/ws", websocketGatewayRouter],
  ["rt/cache", cacheRouter],
];

// "createApp" => Factory Function asíncrona: Apollo Server debe iniciarse (await) antes de montar /graphql
export async function createApp(): Promise<Express> {
  const app = express();

  // "trust proxy" => detrás de Nginx/ALB, req.ip es la IP real del cliente (necesario para el rate limit)
  app.set("trust proxy", 1);
  app.disable("x-powered-by"); // No revelar la tecnología del servidor

  // --- Middlewares globales (se ejecutan en TODAS las requests, en el orden declarado) ---
  app.use(helmet()); // 1º: headers de seguridad antes que cualquier otra cosa
  app.use(corsMiddleware); // Lista blanca de orígenes (CORS_ORIGINS)
  app.use(requestLogger); // Log estructurado de cada request (método, ruta, status, duración)

  // Webhook de Stripe ANTES de express.json(): necesita el cuerpo crudo para verificar la firma
  app.use("/webhook/payment", paymentWebhookRouter);
  app.use("/webhook/channel", channelWebhookRouter); // RF-19.3 pedidos de Meta y TikTok Shop (firma sobre el cuerpo crudo)

  app.use(express.json({ limit: "1mb" })); // Parsea JSON con límite de tamaño (protección contra payloads gigantes)
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(idempotency); // RF-28.7 reintentos con "Idempotency-Key" sin duplicar la acción

  // Inicializa Passport y registra las strategies ANTES de montar las rutas que las usan
  configurePassport();
  app.use(passport.initialize());

  // --- API REST v1 --- (un solo registro monta las rutas Y genera la documentación: DRY)
  for (const [segment, router] of API_MODULES) app.use(`${API_PREFIX}/${segment}`, router);

  // --- Documentación OpenAPI 3.0 (/api/docs) --- fuera de producción no expone la superficie de la API
  if (!isProduction) mountSwagger(app, API_MODULES, API_PREFIX);

  // --- API GraphQL (catálogo, solo lectura) ---
  app.use(GRAPHQL_PATH, optionalAuth, await createGraphqlHandler());

  // Liveness: el proceso responde (Docker healthcheck / Kubernetes livenessProbe)
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Readiness: además la base de datos responde (Kubernetes readinessProbe: no enviar tráfico si la DB cayó)
  app.get("/ready", (_req: Request, res: Response) => {
    prisma.$queryRaw`SELECT 1`
      .then(() => res.status(200).json({ status: "ready" }))
      .catch(() => res.status(503).json({ status: "unavailable" }));
  });

  // 404 en formato JSON estándar para rutas de la API inexistentes (en vez del HTML por defecto de Express)
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ success: false, message: "Recurso no encontrado", code: "ROUTE_NOT_FOUND" });
  });

  // El middleware de errores SIEMPRE se registra AL FINAL (Express lo detecta por su firma de 4 argumentos)
  app.use(errorMiddleware);

  return app;
}
