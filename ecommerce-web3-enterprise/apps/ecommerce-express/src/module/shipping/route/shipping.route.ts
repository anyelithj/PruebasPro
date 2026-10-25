// shipping.route.ts => cotizar: cualquier usuario autenticado; gestión logística: permisos RBAC de "shipping".
import { Router } from "express";
import { shippingController } from "../controller/shipping.controller";
import { jwtAuthGuard } from "../../auth/guard/auth.guard";
import { requirePermission } from "../../../shared/middleware/rbac.middleware";
import { rateLimit } from "../../../shared/middleware/rate-limit.middleware";

export const shippingRouter = Router();
shippingRouter.use(jwtAuthGuard);

shippingRouter.post("/rate", shippingController.createShippingRate);
// Rutas literales ANTES de "/:id" (Express las evalúa en orden)
shippingRouter.get("/address-suggest", rateLimit({ bucket: "address-suggest", limit: 30, windowSeconds: 60 }), shippingController.addressSuggest); // RF-08.2
shippingRouter.get("/stats", requirePermission("READ", "shipping"), shippingController.carrierStats); // RF-10.7
shippingRouter.post("/label", requirePermission("CREATE", "shipping"), shippingController.createShippingLabel);
shippingRouter.get("/", requirePermission("READ", "shipping"), shippingController.listShippings);
shippingRouter.get("/:id", shippingController.getShippingById); // Dueño del pedido o staff (lo valida el service)
shippingRouter.get("/:id/label", requirePermission("READ", "shipping"), shippingController.downloadLabel);
shippingRouter.delete("/:id/label", requirePermission("UPDATE", "shipping"), shippingController.voidShippingLabel); // Anular guía => vuelve a PENDING
shippingRouter.get("/:id/tracking", shippingController.tracking); // Dueño del pedido o staff (RF-09.1/09.3/10.5)
shippingRouter.patch("/:id", requirePermission("UPDATE", "shipping"), shippingController.updateShipping);
shippingRouter.delete("/:id", requirePermission("UPDATE", "shipping"), shippingController.deleteShippingById);
