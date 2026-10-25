// automation.route.ts => gestión de flujos n8n: solo administradores (pueden enviar correos/WhatsApp masivos).
import { Router } from "express";
import { automationController } from "../controller/automation.controller";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { rateLimit } from "../../../shared/middleware/rate-limit.middleware";
import { Roles } from "../../../shared/constants/roles.constants";

export const automationRouter = Router();
automationRouter.use(jwtAuthGuard, requireRoles(Roles.ADMIN));

// Rutas fijas ANTES de "/:id"
automationRouter.get("/health", automationController.health); // RF-20.7 tablero de salud
automationRouter.get("/template", automationController.templates); // RF-20.2 plantillas
automationRouter.get("/template/:key", automationController.template);
automationRouter.post("/template/:key", automationController.installTemplate);
automationRouter.post("/action/whatsapp", automationController.whatsappAction); // RF-20.6 acciones que llama n8n
automationRouter.post("/action/notify-staff", automationController.notifyStaff);
automationRouter.post("/action/dispatch-campaigns", automationController.dispatchCampaigns);
automationRouter.post("/", automationController.createWorkflow);
automationRouter.get("/", automationController.listWorkflows);
automationRouter.get("/:id", automationController.getWorkflowById);
automationRouter.patch("/:id", automationController.updateWorkflow);
automationRouter.delete("/:id", automationController.deleteWorkflowById);
// Ejecuciones manuales acotadas: 30 por minuto (cada una puede enviar mensajes reales)
automationRouter.get("/:id/versions", automationController.versions); // RF-20.7 historial
automationRouter.post("/:id/rollback", automationController.rollback);
automationRouter.post("/:id/run", rateLimit({ bucket: "automation-run", limit: 30, windowSeconds: 60 }), automationController.createWorkflowRun);
