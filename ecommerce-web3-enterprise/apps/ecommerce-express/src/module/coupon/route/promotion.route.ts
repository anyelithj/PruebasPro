// promotion.route.ts => promociones automáticas (montado en /api/v1/promotion). Las ofertas flash son PÚBLICAS (la
// tienda muestra el contador sin sesión); la gestión usa los mismos permisos RBAC de "coupon" (Chain of Responsibility).
import { Router } from "express";
import { promotionController } from "../controller/promotion.controller";
import { jwtAuthGuard } from "../../auth/guard/auth.guard";
import { requirePermission } from "../../../shared/middleware/rbac.middleware";

export const promotionRouter = Router();

promotionRouter.get("/flash", promotionController.flash); // RF-13.8 (pública)
promotionRouter.get("/history", jwtAuthGuard, requirePermission("READ", "coupon"), promotionController.history); // RF-13.10
promotionRouter.post("/seasonal", jwtAuthGuard, requirePermission("CREATE", "coupon"), promotionController.seasonal); // RF-13.9
promotionRouter.get("/", jwtAuthGuard, requirePermission("READ", "coupon"), promotionController.list);
promotionRouter.post("/", jwtAuthGuard, requirePermission("CREATE", "coupon"), promotionController.create);
promotionRouter.patch("/:id", jwtAuthGuard, requirePermission("UPDATE", "coupon"), promotionController.update);
