// cms.route.ts => rutas del CMS (montado en /api/v1/cms). Lecturas públicas con optionalAuth (el staff ve borradores);
// escrituras solo ADMIN (jwtAuthGuard + requireRoles: patrón Guard). Las rutas fijas (/lead, /config) van ANTES de
// "/:kind" para que Express no las confunda con un tipo de contenido.
import { Router } from "express";
import { cmsController } from "../controller/cms.controller";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { optionalAuth } from "../../../shared/middleware/jwt.middleware";
import { rateLimit } from "../../../shared/middleware/rate-limit.middleware";
import { Roles } from "../../../shared/constants/roles.constants";

export const cmsRouter = Router();
const admin = [jwtAuthGuard, requireRoles(Roles.ADMIN)];

// Leads (captura pública con rate limit anti-spam; listado solo admin)
cmsRouter.post("/landing/:slug/lead", rateLimit({ bucket: "cms-lead", limit: 5, windowSeconds: 600 }), cmsController.createLandingLead);
cmsRouter.get("/lead", ...admin, cmsController.listLandingLeads);

// Configuración global de la tienda
cmsRouter.get("/config", optionalAuth, cmsController.getStoreConfig);
cmsRouter.put("/config/:section", ...admin, cmsController.updateStoreConfig);

// Contenido por tipo: page | landing | lookbook | event
cmsRouter.get("/:kind", optionalAuth, cmsController.listCmsContents);
cmsRouter.get("/:kind/:slug", optionalAuth, cmsController.getCmsContentBySlug);
cmsRouter.post("/:kind", ...admin, cmsController.createCmsContent);
cmsRouter.patch("/:kind/:id", ...admin, cmsController.updateCmsContent);
cmsRouter.delete("/:kind/:id", ...admin, cmsController.deleteCmsContentById);
