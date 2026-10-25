// refund.route.ts => clientes solicitan/consultan/cancelan las suyas; aprobar exige permiso UPDATE:refund.
import { Router } from "express";
import { refundController } from "../controller/refund.controller";
import { jwtAuthGuard } from "../../auth/guard/auth.guard";
import { requirePermission } from "../../../shared/middleware/rbac.middleware";

export const refundRouter = Router();
refundRouter.use(jwtAuthGuard);

refundRouter.post("/", refundController.createRefund);
refundRouter.get("/", refundController.listRefunds);
refundRouter.get("/stats", requirePermission("UPDATE", "refund"), refundController.stats); // RF-12.9 (antes de "/:id")
refundRouter.get("/:id", refundController.getRefundById);
refundRouter.patch("/:id/approve", requirePermission("UPDATE", "refund"), refundController.reviewRefund);
refundRouter.patch("/:id/return", requirePermission("UPDATE", "refund"), refundController.updateReturnStatus); // RF-12.2
refundRouter.post("/:id/inspection", requirePermission("UPDATE", "refund"), refundController.inspect); // RF-12.7 / 12.5
refundRouter.get("/:id/label", refundController.label); // RF-12.2 dueño o staff (lo valida el service)
refundRouter.delete("/:id", refundController.cancelRefund);
