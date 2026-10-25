// product.route.ts => lecturas públicas (con vista de staff vía optionalAuth), escrituras con permiso RBAC.
import { Router } from "express";
import { productController } from "../controller/product.controller";
import { jwtAuthGuard } from "../../auth/guard/auth.guard";
import { optionalAuth } from "../../../shared/middleware/jwt.middleware";
import { requirePermission } from "../../../shared/middleware/rbac.middleware";
import { spreadsheetUpload } from "../../../shared/middleware/upload.middleware";

export const productRouter = Router();

// RF-04.3 operaciones masivas: se declaran ANTES de "/:id" ("export", "import" y "bulk" no son IDs)
productRouter.get("/export", jwtAuthGuard, requirePermission("READ", "product"), productController.exportProducts);
productRouter.post("/import", jwtAuthGuard, requirePermission("CREATE", "product"), spreadsheetUpload.single("file"), productController.importProducts);
productRouter.patch("/bulk", jwtAuthGuard, requirePermission("UPDATE", "product"), productController.bulkUpdateProducts);
productRouter.post("/:id/duplicate", jwtAuthGuard, requirePermission("CREATE", "product"), productController.duplicateProduct);
productRouter.get("/", optionalAuth, productController.listProducts);
productRouter.get("/:id", optionalAuth, productController.getProductById);
productRouter.post("/", jwtAuthGuard, requirePermission("CREATE", "product"), productController.createProduct);
productRouter.patch("/:id", jwtAuthGuard, requirePermission("UPDATE", "product"), productController.updateProduct);
productRouter.delete("/", jwtAuthGuard, requirePermission("DELETE", "product"), productController.deleteAllProducts);
productRouter.delete("/:id", jwtAuthGuard, requirePermission("DELETE", "product"), productController.deleteProductById);
