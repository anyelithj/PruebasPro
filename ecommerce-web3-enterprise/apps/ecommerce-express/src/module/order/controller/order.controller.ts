// order.controller.ts => capa HTTP del módulo Order.
import type { Request, Response } from "express";
import { orderService } from "../service/order.service";
import { proofNftService } from "../service/proof-nft.service"; // RF-29.3
import { z } from "zod";
import { CancelOrderSchema, ListOrdersQuerySchema, ManualOrderSchema, PlaceOrderSchema, UpdateDeliverySchema, UpdateOrderStatusSchema } from "../schema/order.schema";
import { asyncHandler, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class OrderController {
  // GET /api/v1/order/:id/proof-nft => estado del NFT de prueba de compra (RF-29.3)
  public readonly getProofNft = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await proofNftService.get(parseId(req), currentUser(req).id));
  });
  // POST /api/v1/order/:id/proof-nft => mintea (o reintenta) el certificado en la wallet del cliente
  public readonly mintProofNft = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await proofNftService.mint(parseId(req), currentUser(req).id), HttpStatus.CREATED);
  });
  // GET /api/v1/order/proof/verify?hash= (público) => verificación de un certificado por su hash
  public readonly verifyProof = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await proofNftService.verify(z.object({ hash: z.string().regex(/^[a-f0-9]{64}$/) }).parse(req.query).hash));
  });

  // placeOrder => POST /api/v1/order (idempotente: devuelve el pedido existente si ya se creó por webhook)
  public readonly placeOrder = asyncHandler(async (req: Request, res: Response) => {
    const { checkoutSessionId } = PlaceOrderSchema.parse(req.body);
    sendSuccess(res, await orderService.placeOrder(checkoutSessionId, currentUser(req)), HttpStatus.CREATED);
  });

  // createManualOrder => POST /api/v1/order/manual (ADMIN); ".parse" (Zod) valida el body y responde 400 si no cumple
  public readonly createManualOrder = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await orderService.createManualOrder(ManualOrderSchema.parse(req.body), currentUser(req)), HttpStatus.CREATED);
  });

  public readonly listOrders = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await orderService.listOrders(ListOrdersQuerySchema.parse(req.query), currentUser(req));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  public readonly getOrderById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await orderService.getOrderById(parseId(req), currentUser(req)));
  });

  // updateOrderStatus => PATCH /api/v1/order/:id/status
  public readonly updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status, note } = UpdateOrderStatusSchema.parse(req.body);
    sendSuccess(res, await orderService.updateOrderStatus(parseId(req), status, note, currentUser(req)));
  });

  // updateDelivery => PATCH /api/v1/order/:id/delivery (RF-09.3 reprogramar e instrucciones)
  public readonly updateDelivery = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await orderService.updateDelivery(parseId(req), UpdateDeliverySchema.parse(req.body), currentUser(req)));
  });

  // reorder => POST /api/v1/order/:id/reorder (RF-09.4 volver a pedir)
  public readonly reorder = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await orderService.reorder(parseId(req), currentUser(req)), HttpStatus.CREATED);
  });

  // cancelOrder => DELETE /api/v1/order/:id (devuelve el pedido cancelado: la UI muestra el nuevo estado)
  public readonly cancelOrder = asyncHandler(async (req: Request, res: Response) => {
    const { reason } = CancelOrderSchema.parse(req.body ?? {});
    sendSuccess(res, await orderService.cancelOrder(parseId(req), reason, currentUser(req)));
  });
}

export const orderController = new OrderController();
