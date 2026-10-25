// order.route.ts => todos los endpoints requieren sesión; la visibilidad (propios/staff) la decide el service.
import { Router } from "express";
import { orderController } from "../controller/order.controller";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { Roles } from "../../../shared/constants/roles.constants";
import { requirePermission } from "../../../shared/middleware/rbac.middleware";

export const orderRouter = Router();
// RF-29.3 verificación pública de un certificado de compra por su hash (antes del guard JWT)
orderRouter.get("/proof/verify", orderController.verifyProof);
orderRouter.use(jwtAuthGuard);

orderRouter.post("/", orderController.placeOrder);
// Pedido creado por el staff (venta asistida o pruebas): solo ADMIN (Guard); el service valida stock y precios
orderRouter.post("/manual", requireRoles(Roles.ADMIN), orderController.createManualOrder);
orderRouter.get("/", orderController.listOrders);
orderRouter.get("/:id", orderController.getOrderById);
orderRouter.get("/:id/proof-nft", orderController.getProofNft); // RF-29.3
orderRouter.post("/:id/proof-nft", orderController.mintProofNft);
// Cambiar el estado es operación de staff (permiso granular UPDATE:order)
orderRouter.patch("/:id/status", requirePermission("UPDATE", "order"), orderController.updateOrderStatus);
// RF-09.3 reprogramar entrega e instrucciones; RF-09.4 volver a pedir (solo el comprador: lo valida el service)
orderRouter.patch("/:id/delivery", orderController.updateDelivery);
orderRouter.post("/:id/reorder", orderController.reorder);
// Cancelar: el dueño o el staff (el service valida ownership y estado)
orderRouter.delete("/:id", orderController.cancelOrder);
