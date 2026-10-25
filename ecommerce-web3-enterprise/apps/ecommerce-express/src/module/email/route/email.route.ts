// email.route.ts => correo (montado en /api/v1/email). El píxel de apertura es público (lo pide el cliente de
// correo, sin token); todo lo demás exige ADMIN. Orden: rutas literales ("/template", "/send") antes de "/:id".
import { Router } from "express";
import { emailController } from "../controller/email.controller";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { rateLimit } from "../../../shared/middleware/rate-limit.middleware";
import { Roles } from "../../../shared/constants/roles.constants";

export const emailRouter = Router();
const admin = [jwtAuthGuard, requireRoles(Roles.ADMIN)];

// Píxel público con límite por IP (evita inflar métricas o usarlo para tráfico basura)
emailRouter.get("/:id/open", rateLimit({ bucket: "email-open", limit: 120, windowSeconds: 60 }), emailController.trackOpen);
emailRouter.get("/:id/click", rateLimit({ bucket: "email-click", limit: 120, windowSeconds: 60 }), emailController.trackClick); // RF-21.5

emailRouter.post("/send", ...admin, rateLimit({ bucket: "email-send", limit: 20, windowSeconds: 60 }), emailController.createEmail);
emailRouter.get("/template", ...admin, emailController.listEmailTemplates);
emailRouter.post("/template/preview", ...admin, emailController.previewTemplate); // RF-21.6
emailRouter.post("/template", ...admin, emailController.createEmailTemplate);
emailRouter.patch("/template/:id", ...admin, emailController.updateEmailTemplate);
emailRouter.delete("/template/:id", ...admin, emailController.deleteEmailTemplateById);
emailRouter.get("/", ...admin, emailController.listEmails);
emailRouter.get("/:id", ...admin, emailController.getEmailById);
