// audit.route.ts => audit trail (montado en /api/v1/audit): solo administradores (AdminGuard).
// Cadena (Chain of Responsibility): jwtAuthGuard -> requireRoles(ADMIN) -> controller.
import { Router } from "express";
import { auditController } from "../controller/audit.controller";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { Roles } from "../../../shared/constants/roles.constants";

export const auditRouter = Router();
auditRouter.use(jwtAuthGuard, requireRoles(Roles.ADMIN));

auditRouter.post("/log", auditController.createAuditLog);
auditRouter.get("/log", auditController.listAuditLogs);
auditRouter.get("/log/export", auditController.exportAuditLogs); // RF-30.3 CSV / PDF (ruta fija antes de "/log/:id")
auditRouter.get("/compliance", auditController.complianceReport); // RF-30.7
auditRouter.post("/anomaly/scan", auditController.scanAnomalies); // RF-30.4
auditRouter.patch("/log/:id", auditController.updateAuditLog);
auditRouter.delete("/log", auditController.deleteAllAuditLogs);
auditRouter.get("/report", auditController.listAuditReports);
