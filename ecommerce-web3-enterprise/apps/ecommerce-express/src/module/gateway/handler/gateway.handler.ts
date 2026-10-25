// gateway.handler.ts (Express) => capa HTTP del proxy de pagos (montada en /api/v1/rt/gateway). Usuario autenticado.
// Lee el header "Idempotency-Key", valida con Zod y delega en el service (Thin Controller). Patrón Proxy.
import { Router, type Request, type Response } from "express";
import { gatewayService } from "../service/gateway.service";
import { PaymentRequestSchema, RetryRequestSchema } from "../dto/gateway.dto";
import { jwtAuthGuard } from "../../auth/guard/auth.guard";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId } from "../../../shared/pipe/validation.pipe";

// idempotencyKey => "req.get" lee el header sin importar mayúsculas/minúsculas
const idempotencyKey = (req: Request) => req.get("Idempotency-Key");

export const gatewayRouter = Router();
gatewayRouter.use(jwtAuthGuard);

// POST /api/v1/rt/gateway/payment/process => createPaymentProxy()
gatewayRouter.post(
  "/payment/process",
  asyncHandler(async (req: Request, res: Response) => {
    const input = PaymentRequestSchema.parse({ ...req.body, idempotencyKey: idempotencyKey(req) });
    sendSuccess(res, await gatewayService.process(input, currentUser(req)), HttpStatus.CREATED);
  })
);

// POST /api/v1/rt/gateway/payment/:id/retry => createRetryAttempt()
gatewayRouter.post(
  "/payment/:id/retry",
  asyncHandler(async (req: Request, res: Response) => {
    const input = RetryRequestSchema.parse({ idempotencyKey: idempotencyKey(req) });
    sendSuccess(res, await gatewayService.retry(parseId(req), input, currentUser(req)), HttpStatus.CREATED);
  })
);

// GET /api/v1/rt/gateway/payment/:id => getPaymentProxyById()
gatewayRouter.get(
  "/payment/:id",
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await gatewayService.getById(parseId(req), currentUser(req)));
  })
);

// DELETE /api/v1/rt/gateway/payment/:id => deletePaymentProxyById() (anula la pre-autorización)
gatewayRouter.delete(
  "/payment/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await gatewayService.cancel(parseId(req), currentUser(req));
    sendNoContent(res);
  })
);
