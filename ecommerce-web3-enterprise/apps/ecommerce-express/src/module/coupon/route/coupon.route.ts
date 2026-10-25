// coupon.route.ts => la validación la usa cualquier cliente autenticado; la gestión, permisos RBAC de "coupon".
import { Router } from "express";
import { couponController } from "../controller/coupon.controller";
import { jwtAuthGuard } from "../../auth/guard/auth.guard";
import { requirePermission } from "../../../shared/middleware/rbac.middleware";
import { rateLimit } from "../../../shared/middleware/rate-limit.middleware";

export const couponRouter = Router();
couponRouter.use(jwtAuthGuard);

// Rate limit en la validación: evita enumerar códigos por fuerza bruta
couponRouter.post("/validate", rateLimit({ bucket: "coupon-validate", limit: 30, windowSeconds: 600 }), couponController.validateCoupon);

couponRouter.get("/", requirePermission("READ", "coupon"), couponController.listCoupons);
couponRouter.get("/:id", requirePermission("READ", "coupon"), couponController.getCouponById);
couponRouter.post("/", requirePermission("CREATE", "coupon"), couponController.createCoupon);
couponRouter.patch("/:id", requirePermission("UPDATE", "coupon"), couponController.updateCoupon);
couponRouter.delete("/:id", requirePermission("DELETE", "coupon"), couponController.deleteCouponById);
