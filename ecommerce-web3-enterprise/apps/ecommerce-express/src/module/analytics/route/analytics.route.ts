// analytics.route.ts => analítica (montado en /api/v1/analytic). El tracking es público (visitantes anónimos) con
// autenticación OPCIONAL (asocia el usuario si inició sesión) y límite por IP; las lecturas y la purga, solo ADMIN.
import { Router } from "express";
import { analyticsController } from "../controller/analytics.controller";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { optionalAuth } from "../../../shared/middleware/jwt.middleware";
import { rateLimit } from "../../../shared/middleware/rate-limit.middleware";
import { Roles } from "../../../shared/constants/roles.constants";

export const analyticsRouter = Router();
const admin = [jwtAuthGuard, requireRoles(Roles.ADMIN)];

// 60 lotes por minuto por IP (cada lote trae hasta 50 eventos): suficiente para navegar, corta el abuso
analyticsRouter.post("/event", rateLimit({ bucket: "analytics-track", limit: 60, windowSeconds: 60 }), optionalAuth, analyticsController.createAnalyticEvent);
analyticsRouter.get("/event", ...admin, analyticsController.listAnalyticEvents);
analyticsRouter.delete("/event", ...admin, analyticsController.deleteAllAnalyticEvents);
analyticsRouter.get("/metric", ...admin, analyticsController.listMetrics);
analyticsRouter.get("/export", ...admin, analyticsController.exportReport); // RF-24.6
analyticsRouter.get("/heatmap", ...admin, analyticsController.heatmap); // RF-24.8
analyticsRouter.get("/performance", ...admin, analyticsController.performance);
analyticsRouter.get("/journey/:id", ...admin, analyticsController.journey); // RF-22.9
analyticsRouter.get("/attribution", ...admin, analyticsController.attribution); // RF-24.11
analyticsRouter.get("/crypto", ...admin, analyticsController.crypto); // RF-24.12
analyticsRouter.get("/alert", ...admin, analyticsController.alertRules); // RF-24.10
analyticsRouter.post("/alert", ...admin, analyticsController.createAlertRule);
analyticsRouter.patch("/alert/:id", ...admin, analyticsController.updateAlertRule);
analyticsRouter.delete("/alert/:id", ...admin, analyticsController.deleteAlertRule);
analyticsRouter.get("/report", ...admin, analyticsController.listAnalyticReports);
