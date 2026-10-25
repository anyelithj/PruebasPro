// communication.route.ts => conversaciones del usuario autenticado (cliente: las suyas; admin/agente: todas).
import { Router } from "express";
import { communicationController } from "../controller/communication.controller";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { Roles } from "../../../shared/constants/roles.constants";
import { optionalAuth } from "../../../shared/middleware/jwt.middleware";
import { rateLimit } from "../../../shared/middleware/rate-limit.middleware";

export const communicationRouter = Router();
// RF-17.11 webhook de Chatwoot: ANTES del guard JWT (lo autentica el token secreto de la URL)
communicationRouter.post("/chatwoot/webhook", rateLimit({ bucket: "chatwoot-webhook", limit: 600, windowSeconds: 60 }), communicationController.chatwootWebhook);
// RF-21.2 formulario de contacto público (sesión opcional), con límite anti-spam por IP
communicationRouter.post("/contact", rateLimit({ bucket: "contact-form", limit: 5, windowSeconds: 600 }), optionalAuth, communicationController.contact);
communicationRouter.use(jwtAuthGuard);
// Bandeja de soporte (solo ADMIN): rutas fijas antes de "/:id"
const staff = requireRoles(Roles.ADMIN);
communicationRouter.get("/support/metrics", staff, communicationController.metrics); // RF-17.12
communicationRouter.get("/support/canned", staff, communicationController.listCanned); // RF-17.11
communicationRouter.post("/support/canned", staff, communicationController.createCanned);
communicationRouter.get("/support/agents", staff, communicationController.agents);
communicationRouter.get("/contact", staff, communicationController.listContact); // RF-21.2 bandeja de contacto
communicationRouter.patch("/contact/:id", staff, communicationController.updateContact);

communicationRouter.post("/", rateLimit({ bucket: "conversation-create", limit: 10, windowSeconds: 60 }), communicationController.createConversation);
communicationRouter.get("/", communicationController.listConversations);
communicationRouter.get("/:id", communicationController.getConversationById);
communicationRouter.patch("/:id/escalate", communicationController.updateConversation);
communicationRouter.post("/:id/message", rateLimit({ bucket: "conversation-message", limit: 60, windowSeconds: 60 }), communicationController.postMessage);
communicationRouter.post("/:id/assign", staff, communicationController.assign); // RF-17.11
communicationRouter.delete("/:id", communicationController.deleteConversationById);
