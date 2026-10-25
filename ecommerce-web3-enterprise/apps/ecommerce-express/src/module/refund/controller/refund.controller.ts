// refund.controller.ts => capa HTTP del módulo Refund.
import type { Request, Response } from "express";
import { refundService } from "../service/refund.service";
import { CreateRefundSchema, InspectionSchema, ListRefundsQuerySchema, RefundStatsQuerySchema, ReturnStatusSchema, ReviewRefundSchema } from "../schema/refund.schema";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class RefundController {
  public readonly createRefund = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await refundService.createRefund(CreateRefundSchema.parse(req.body), currentUser(req).id), HttpStatus.CREATED);
  });

  public readonly listRefunds = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await refundService.listRefunds(ListRefundsQuerySchema.parse(req.query), currentUser(req));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  public readonly getRefundById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await refundService.getRefundById(parseId(req), currentUser(req)));
  });

  // updateRefund => PATCH /api/v1/refund/:id/approve
  public readonly reviewRefund = asyncHandler(async (req: Request, res: Response) => {
    const { approve, note } = ReviewRefundSchema.parse(req.body);
    sendSuccess(res, await refundService.reviewRefund(parseId(req), approve, note, currentUser(req).id));
  });

  // RF-12.2 seguimiento y etiqueta; RF-12.7 inspección; RF-12.9 estadísticas
  public readonly updateReturnStatus = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await refundService.updateReturnStatus(parseId(req), ReturnStatusSchema.parse(req.body).status));
  });
  public readonly inspect = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await refundService.inspect(parseId(req), InspectionSchema.parse(req.body), currentUser(req).id));
  });
  public readonly label = asyncHandler(async (req: Request, res: Response) => {
    const pdf = await refundService.label(parseId(req), currentUser(req));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="devolucion-${parseId(req)}.pdf"`);
    res.send(pdf);
  });
  public readonly stats = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await refundService.stats(RefundStatsQuerySchema.parse(req.query).days));
  });

  public readonly cancelRefund = asyncHandler(async (req: Request, res: Response) => {
    await refundService.cancelRefund(parseId(req), currentUser(req));
    sendNoContent(res);
  });
}

export const refundController = new RefundController();
