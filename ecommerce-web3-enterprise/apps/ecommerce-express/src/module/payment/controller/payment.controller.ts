// payment.controller.ts => capa HTTP del módulo Payment (incluye el webhook de Stripe).
import type { Request, Response } from "express";
import { paymentService, savedPaymentMethodService } from "../service/payment.service";
import { CryptoConfirmSchema, CryptoQuoteSchema, ListPaymentsQuerySchema, OfflinePaymentSchema, OneClickSchema, PaymentMethodParamSchema, ProcessPaymentSchema, RefundPaymentSchema } from "../schema/payment.schema";
import { deviceContext } from "../../../shared/util/device.util"; // RF-08.11 huella del dispositivo y país de la IP
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class PaymentController {
  // processPayment => POST /api/v1/payment/process
  public readonly processPayment = asyncHandler(async (req: Request, res: Response) => {
    const { checkoutSessionId } = ProcessPaymentSchema.parse(req.body);
    sendSuccess(res, await paymentService.processPayment(checkoutSessionId, currentUser(req).id, { device: deviceContext(req) }), HttpStatus.CREATED);
  });

  // oneClick => POST /api/v1/payment/one-click (RF-08.1)
  public readonly oneClick = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await paymentService.oneClick(currentUser(req).id, OneClickSchema.parse(req.body), deviceContext(req)), HttpStatus.CREATED);
  });

  // offlinePayment => POST /api/v1/payment/offline (RF-08.3 transferencia / contra entrega)
  public readonly offlinePayment = asyncHandler(async (req: Request, res: Response) => {
    const { checkoutSessionId, method } = OfflinePaymentSchema.parse(req.body);
    sendSuccess(res, await paymentService.offlinePayment(checkoutSessionId, currentUser(req).id, method, deviceContext(req)), HttpStatus.CREATED);
  });

  // confirmOfflinePayment => PATCH /api/v1/payment/:id/confirm (ADMIN: llegó la transferencia)
  public readonly confirmOfflinePayment = asyncHandler(async (req: Request, res: Response) => {
    await paymentService.confirmOfflinePayment(parseId(req));
    sendNoContent(res);
  });

  // cryptoQuote => POST /api/v1/payment/crypto/quote (RF-08.9)
  public readonly cryptoQuote = asyncHandler(async (req: Request, res: Response) => {
    const { checkoutSessionId, asset, network } = CryptoQuoteSchema.parse(req.body);
    sendSuccess(res, await paymentService.cryptoQuote(checkoutSessionId, currentUser(req).id, asset, network, deviceContext(req)), HttpStatus.CREATED);
  });

  // confirmCrypto => POST /api/v1/payment/crypto/:id/confirm (RF-08.9 verificación on-chain)
  public readonly confirmCrypto = asyncHandler(async (req: Request, res: Response) => {
    const { txHash } = CryptoConfirmSchema.parse(req.body);
    sendSuccess(res, await paymentService.confirmCrypto(parseId(req), currentUser(req).id, txHash));
  });

  public readonly listPayments = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await paymentService.listPayments(ListPaymentsQuerySchema.parse(req.query), currentUser(req));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  public readonly getPaymentById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await paymentService.getPaymentById(parseId(req), currentUser(req)));
  });

  // ---------- RF-02.3 métodos de pago guardados (siempre del usuario autenticado: sin :userId en la URL) ----------
  // listPaymentMethods => GET /api/v1/payment/methods
  public readonly listPaymentMethods = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await savedPaymentMethodService.listPaymentMethods(currentUser(req).id));
  });

  // createSetupIntent => POST /api/v1/payment/methods/setup-intent
  public readonly createSetupIntent = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await savedPaymentMethodService.createSetupIntent(currentUser(req).id), HttpStatus.CREATED);
  });

  // setDefaultPaymentMethod => PATCH /api/v1/payment/methods/:methodId (marca el predeterminado)
  public readonly setDefaultPaymentMethod = asyncHandler(async (req: Request, res: Response) => {
    const { methodId } = PaymentMethodParamSchema.parse(req.params);
    await savedPaymentMethodService.setDefaultPaymentMethod(currentUser(req).id, methodId);
    sendNoContent(res);
  });

  // deletePaymentMethod => DELETE /api/v1/payment/methods/:methodId
  public readonly deletePaymentMethod = asyncHandler(async (req: Request, res: Response) => {
    const { methodId } = PaymentMethodParamSchema.parse(req.params);
    await savedPaymentMethodService.deletePaymentMethod(currentUser(req).id, methodId);
    sendNoContent(res);
  });

  // voidPayment => DELETE /api/v1/payment/:id
  public readonly voidPayment = asyncHandler(async (req: Request, res: Response) => {
    await paymentService.voidPayment(parseId(req), currentUser(req));
    sendNoContent(res);
  });

  // createRefund => POST /api/v1/payment/refund (admin: ejecuta en Stripe una devolución aprobada)
  public readonly createRefund = asyncHandler(async (req: Request, res: Response) => {
    const { refundId } = RefundPaymentSchema.parse(req.body);
    await paymentService.refundPayment(refundId);
    sendSuccess(res, { refundId, status: "PROCESSED" }, HttpStatus.CREATED);
  });

  // createPaymentWebhook => POST /webhook/payment/stripe (req.body es un Buffer gracias a express.raw)
  public readonly stripeWebhook = asyncHandler(async (req: Request, res: Response) => {
    await paymentService.handleWebhook(req.body as Buffer, req.header("stripe-signature"));
    res.status(200).json({ received: true }); // 2xx => Stripe no reintenta
  });
}

export const paymentController = new PaymentController();
