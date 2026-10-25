// category.route.ts => lecturas públicas (storefront) y escrituras protegidas por permiso RBAC.
import { Router } from "express";
import { categoryController } from "../controller/category.controller";
import { jwtAuthGuard } from "../../auth/guard/auth.guard";
import { optionalAuth } from "../../../shared/middleware/jwt.middleware";
import { requirePermission } from "../../../shared/middleware/rbac.middleware";

export const categoryRouter = Router();

// Públicas: el menú y las páginas de categoría no requieren sesión (optionalAuth para vistas de staff)
categoryRouter.get("/", optionalAuth, categoryController.listCategories);
categoryRouter.get("/:id", categoryController.getCategoryById);

// Escrituras: permiso granular sobre el recurso "category"
categoryRouter.post("/", jwtAuthGuard, requirePermission("CREATE", "category"), categoryController.createCategory);
categoryRouter.patch("/:id", jwtAuthGuard, requirePermission("UPDATE", "category"), categoryController.updateCategory);
categoryRouter.delete("/:id", jwtAuthGuard, requirePermission("DELETE", "category"), categoryController.deleteCategoryById);
