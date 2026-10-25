// purchase-order.controller.ts => capa HTTP de compras (RF-23.3 / 23.5 / 23.6 / 23.8 / 23.9): valida con Zod y delega
// en el service (SRP). Patrón Controller + Adapter (Request de Express -> casos de uso).
import type { Request, Response } from "express";
import { purchaseOrderService } from "../service/purchase-order.service";
import { ListPurchaseOrdersQuerySchema, PriceComparisonQuerySchema, PurchaseOrderSchema, ReceiveSchema, SendSchema, UpdatePurchaseOrderSchema, ValuationQuerySchema } from "../schema/purchase-order.schema";
import { asyncHandler, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class PurchaseOrderController {
  // POST /api/v1/supplier/purchase-order
  public readonly create = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await purchaseOrderService.create(PurchaseOrderSchema.parse(req.body), currentUser(req).id), HttpStatus.CREATED);
  });
  // GET /api/v1/supplier/purchase-order?supplierId=&status=&payable=
  public readonly list = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await purchaseOrderService.list(ListPurchaseOrdersQuerySchema.parse(req.query));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });
  public readonly get = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await purchaseOrderService.get(parseId(req)));
  });
  public readonly update = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await purchaseOrderService.update(parseId(req), UpdatePurchaseOrderSchema.parse(req.body)));
  });
  // POST /:id/send { channels } => RF-23.9 correo con PDF + WhatsApp
  public readonly send = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await purchaseOrderService.send(parseId(req), SendSchema.parse(req.body ?? {}).channels));
  });
  // POST /:id/receive => RF-23.6 recepción con control de calidad
  public readonly receive = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await purchaseOrderService.receive(parseId(req), ReceiveSchema.parse(req.body), currentUser(req).id));
  });
  public readonly cancel = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await purchaseOrderService.cancel(parseId(req)));
  });
  public readonly pay = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await purchaseOrderService.pay(parseId(req)));
  });
  // GET /api/v1/supplier/ranking (RF-23.5)
  public readonly ranking = asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await purchaseOrderService.ranking());
  });
  // GET /api/v1/supplier/price-comparison?variantId=&q= (RF-23.8)
  public readonly priceComparison = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await purchaseOrderService.priceComparison(PriceComparisonQuerySchema.parse(req.query)));
  });
  // GET /api/v1/supplier/valuation?method=AVERAGE|FIFO (RF-23.3)
  public readonly valuation = asyncHandler(async (req: Request, res: Response) => {
    const { method, limit } = ValuationQuerySchema.parse(req.query);
    sendSuccess(res, await purchaseOrderService.valuation(method, limit));
  });
}

export const purchaseOrderController = new PurchaseOrderController();
