// payment.route.ts => dos routers: la API de pagos (JWT) y el webhook de Stripe (autenticado por firma HMAC).
import express, { Router } from "express";
import { paymentController } from "../controller/payment.controller";
import { jwtAuthGuard } from "../../auth/guard/auth.guard";
import { requirePermission } from "../../../shared/middleware/rbac.middleware";

export const paymentRouter = Router();
paymentRouter.use(jwtAuthGuard);

paymentRouter.post("/process", paymentController.processPayment);
// RF-08.1 un clic; RF-08.3 transferencia / contra entrega; RF-08.9 cripto (cotizar y confirmar en la blockchain)
paymentRouter.post("/one-click", paymentController.oneClick);
paymentRouter.post("/offline", paymentController.offlinePayment);
paymentRouter.post("/crypto/quote", paymentController.cryptoQuote);
paymentRouter.post("/crypto/:id/confirm", paymentController.confirmCrypto);
paymentRouter.patch("/:id/confirm", requirePermission("UPDATE", "payment"), paymentController.confirmOfflinePayment);
paymentRouter.post("/refund", requirePermission("UPDATE", "payment"), paymentController.createRefund);
// RF-02.3 métodos guardados: se declaran ANTES de "/:id" para que "methods" no se interprete como un ID
paymentRouter.get("/methods", paymentController.listPaymentMethods);
paymentRouter.post("/methods/setup-intent", paymentController.createSetupIntent);
paymentRouter.patch("/methods/:methodId", paymentController.setDefaultPaymentMethod);
paymentRouter.delete("/methods/:methodId", paymentController.deletePaymentMethod);
paymentRouter.get("/", paymentController.listPayments);
paymentRouter.get("/:id", paymentController.getPaymentById);
paymentRouter.delete("/:id", paymentController.voidPayment);

// paymentWebhookRouter => se monta en /webhook/payment ANTES de express.json() en app.ts:
// "express.raw" conserva el cuerpo byte a byte, requisito para verificar la firma de Stripe
export const paymentWebhookRouter = Router();
paymentWebhookRouter.post("/stripe", express.raw({ type: "application/json", limit: "1mb" }), paymentController.stripeWebhook);
