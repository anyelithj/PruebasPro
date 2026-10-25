// dashboard.route.ts => panel de administración (montado en /api/v1/dashboard): jwtMiddleware + AdminGuard.
import { Router } from "express";
import { dashboardController } from "../controller/dashboard.controller";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { Roles } from "../../../shared/constants/roles.constants";

export const dashboardRouter = Router();
// GET /vendor => portada del VENDEDOR. Se registra ANTES del "use" de ADMIN: Express evalúa en orden y esta ruta
// responde sin pasar por el guard solo-ADMIN (el VENDOR no ve los KPIs globales de la tienda, solo los suyos)
dashboardRouter.get("/vendor", jwtAuthGuard, requireRoles(Roles.VENDOR), dashboardController.listVendorKPIs);
dashboardRouter.use(jwtAuthGuard, requireRoles(Roles.ADMIN));

dashboardRouter.get("/config", dashboardController.listDashboardConfigs);
dashboardRouter.get("/kpi", dashboardController.listDashboardKPIs);
dashboardRouter.post("/widget", dashboardController.createDashboardWidget);
dashboardRouter.patch("/widget/:id", dashboardController.updateDashboardWidget);
dashboardRouter.delete("/widget/:id", dashboardController.deleteDashboardWidgetById);
