// supplier.route.ts => proveedores (montado en /api/v1/supplier): jwtMiddleware + AdminGuard en todo el router.
import { Router } from "express";
import { supplierController } from "../controller/supplier.controller";
import { purchaseOrderController as po } from "../controller/purchase-order.controller"; // RF-23.3/23.5/23.6/23.8/23.9
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { Roles } from "../../../shared/constants/roles.constants";

export const supplierRouter = Router();
supplierRouter.use(jwtAuthGuard, requireRoles(Roles.ADMIN));

// Compras: rutas fijas ANTES de "/:id"
supplierRouter.get("/ranking", po.ranking);
supplierRouter.get("/price-comparison", po.priceComparison);
supplierRouter.get("/valuation", po.valuation);
supplierRouter.post("/purchase-order", po.create);
supplierRouter.get("/purchase-order", po.list);
supplierRouter.get("/purchase-order/:id", po.get);
supplierRouter.patch("/purchase-order/:id", po.update);
supplierRouter.post("/purchase-order/:id/send", po.send);
supplierRouter.post("/purchase-order/:id/receive", po.receive);
supplierRouter.post("/purchase-order/:id/cancel", po.cancel);
supplierRouter.post("/purchase-order/:id/pay", po.pay);
supplierRouter.post("/", supplierController.createSupplier);
supplierRouter.get("/", supplierController.listSuppliers);
supplierRouter.get("/:id", supplierController.getSupplierById);
supplierRouter.patch("/:id", supplierController.updateSupplier);
supplierRouter.delete("/:id", supplierController.deleteSupplierById);
