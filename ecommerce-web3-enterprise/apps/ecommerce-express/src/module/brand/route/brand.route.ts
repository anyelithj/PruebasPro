// brand.route.ts => lecturas públicas, escrituras con permiso RBAC sobre "brand".
import { Router } from "express";
import { brandController } from "../controller/brand.controller";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { Roles } from "../../../shared/constants/roles.constants";
import { optionalAuth } from "../../../shared/middleware/jwt.middleware";
import { requirePermission } from "../../../shared/middleware/rbac.middleware";

export const brandRouter = Router();

brandRouter.get("/", optionalAuth, brandController.listBrands);
brandRouter.get("/:id/stats", jwtAuthGuard, requireRoles(Roles.ADMIN), brandController.getBrandStats); // RF-05.4
brandRouter.get("/:id", brandController.getBrandById);
brandRouter.post("/", jwtAuthGuard, requirePermission("CREATE", "brand"), brandController.createBrand);
brandRouter.patch("/:id", jwtAuthGuard, requirePermission("UPDATE", "brand"), brandController.updateBrand);
brandRouter.delete("/:id", jwtAuthGuard, requirePermission("DELETE", "brand"), brandController.deleteBrandById);
