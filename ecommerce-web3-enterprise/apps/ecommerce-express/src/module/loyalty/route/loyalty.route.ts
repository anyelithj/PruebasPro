// loyalty.route.ts => consulta y minteo: dueño o admin (lo valida el service); ajustes y purga: RBAC.
import { Router } from "express";
import { loyaltyController } from "../controller/loyalty.controller";
import { jwtAuthGuard } from "../../auth/guard/auth.guard";
import { requirePermission } from "../../../shared/middleware/rbac.middleware";

export const loyaltyRouter = Router();
loyaltyRouter.use(jwtAuthGuard);

// Rutas literales ANTES de "/:id" para que Express no las confunda con un ID
loyaltyRouter.get("/me", loyaltyController.getMyAccount);
loyaltyRouter.post("/me/share", loyaltyController.share); // RF-14.1
loyaltyRouter.get("/me/referral", loyaltyController.referral); // RF-14.1
loyaltyRouter.get("/me/achievements", loyaltyController.achievements); // RF-14.9
loyaltyRouter.post("/me/personal-shopper", loyaltyController.personalShopper); // RF-14.4
loyaltyRouter.get("/ranking", loyaltyController.ranking); // RF-14.5
loyaltyRouter.get("/multiplier", requirePermission("UPDATE", "loyalty"), loyaltyController.listMultipliers); // RF-14.9
loyaltyRouter.post("/multiplier", requirePermission("UPDATE", "loyalty"), loyaltyController.createMultiplier);
loyaltyRouter.patch("/multiplier/:id", requirePermission("UPDATE", "loyalty"), loyaltyController.updateMultiplier);
loyaltyRouter.delete("/expired-point", requirePermission("DELETE", "loyalty"), loyaltyController.purgeExpiredPoints);
loyaltyRouter.get("/:id", loyaltyController.getLoyaltyAccountById);
loyaltyRouter.patch("/:id/point", requirePermission("UPDATE", "loyalty"), loyaltyController.adjustPoints);
loyaltyRouter.get("/:id/badge", loyaltyController.listBadges);
loyaltyRouter.post("/:id/badge/mint", loyaltyController.mintBadge);
loyaltyRouter.post("/:id/badge/:badgeId/transfer", loyaltyController.transferBadge); // RF-14.8
