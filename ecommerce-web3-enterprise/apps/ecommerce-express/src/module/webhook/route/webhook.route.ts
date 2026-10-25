// webhook.route.ts => webhooks salientes (montado en /api/v1/webhook): solo administradores.
// (Los webhooks ENTRANTES de Stripe siguen en /webhook/payment, antes de express.json, porque necesitan el cuerpo crudo.)
import { Router } from "express";
import { webhookController } from "../controller/webhook.controller";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { rateLimit } from "../../../shared/middleware/rate-limit.middleware";
import { Roles } from "../../../shared/constants/roles.constants";

export const webhookRouter = Router();
webhookRouter.use(jwtAuthGuard, requireRoles(Roles.ADMIN));

webhookRouter.post("/", webhookController.createWebhook);
webhookRouter.get("/", webhookController.listWebhooks);
// Pruebas acotadas: cada una hace una petición HTTP real hacia afuera
webhookRouter.post("/execution", rateLimit({ bucket: "webhook-test", limit: 10, windowSeconds: 60 }), webhookController.createWebhookExecution);
webhookRouter.patch("/:id", webhookController.updateWebhook);
webhookRouter.delete("/:id", webhookController.deleteWebhookById);
