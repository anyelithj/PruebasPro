// social.route.ts => feed público (lectura) y publicación para ADMIN/VENDOR (Chain of Responsibility de middlewares).
import express, { Router } from "express";
import { socialController } from "../controller/social.controller";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { optionalAuth } from "../../../shared/middleware/jwt.middleware";
import { Roles } from "../../../shared/constants/roles.constants";

export const socialRouter = Router();
const staff = [jwtAuthGuard, requireRoles(Roles.ADMIN, Roles.VENDOR)]; // Cadena reutilizada (DRY)

socialRouter.get("/product", socialController.listSocialProducts);
// RF-19.1 / 19.7 / 19.10 catálogo multicanal (Meta: Facebook, Instagram, Marketplace, WhatsApp; TikTok Shop)
socialRouter.get("/channel", jwtAuthGuard, requireRoles(Roles.ADMIN), socialController.channelStatus);
socialRouter.post("/channel/sync", jwtAuthGuard, requireRoles(Roles.ADMIN), socialController.syncCatalog);
// RF-19.9 Live Shopping (lectura pública; gestión del staff)
socialRouter.get("/live", socialController.lives);
socialRouter.get("/live/:id", socialController.live);
socialRouter.post("/live/:id/click", socialController.liveClick);
socialRouter.post("/live", ...staff, socialController.createLive);
socialRouter.patch("/live/:id", ...staff, socialController.updateLive);
socialRouter.delete("/live/:id", ...staff, socialController.deleteLive);
// RF-19.11 UGC: galería pública, envío del cliente, moderación e importación de menciones (staff)
socialRouter.get("/ugc", socialController.ugc);
socialRouter.post("/ugc", jwtAuthGuard, socialController.submitUgc);
socialRouter.get("/ugc/queue", ...staff, socialController.ugcQueue);
socialRouter.post("/ugc/import", ...staff, socialController.importUgc);
socialRouter.patch("/ugc/:id", ...staff, socialController.moderateUgc);
socialRouter.get("/product/:id", optionalAuth, socialController.getSocialProduct); // El autor ve también sus borradores
socialRouter.get("/analytic", ...staff, socialController.listSocialAnalytics);
socialRouter.post("/comment", ...staff, socialController.ingestComments); // RF-15.11 (n8n usa un token de staff)
socialRouter.get("/sentiment", ...staff, socialController.sentiment); // RF-15.11
socialRouter.post("/publish", ...staff, socialController.createSocialPost);
socialRouter.patch("/publish/:id", ...staff, socialController.updateSocialPost);
socialRouter.delete("/publish/:id", ...staff, socialController.deleteSocialPostById);

// channelWebhookRouter => RF-19.3 pedidos del checkout nativo (Meta Commerce y TikTok Shop). Se monta en app.ts ANTES
// de express.json(): "express.raw" conserva los bytes exactos para verificar la firma HMAC de cada red
export const channelWebhookRouter = Router();
channelWebhookRouter.get("/meta", socialController.metaVerify); // Verificación de la suscripción (hub.challenge)
channelWebhookRouter.post("/meta", express.raw({ type: "application/json", limit: "1mb" }), socialController.metaWebhook);
channelWebhookRouter.post("/tiktok", express.raw({ type: "application/json", limit: "1mb" }), socialController.tiktokWebhook);
