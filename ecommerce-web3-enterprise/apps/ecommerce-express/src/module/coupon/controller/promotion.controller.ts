// promotion.controller.ts => capa HTTP de las promociones automáticas (valida con Zod y delega en el service: SRP).
import type { Request, Response } from "express";
import { promotionService } from "../service/promotion.service";
import { FlashQuerySchema, PromotionHistoryQuerySchema, PromotionSchema, SeasonalSchema, UpdatePromotionSchema } from "../schema/promotion.schema";
import { asyncHandler, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId } from "../../../shared/pipe/validation.pipe";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class PromotionController {
  // flash => GET /api/v1/promotion/flash?productId= (público: contador regresivo en la tienda, RF-13.8)
  public readonly flash = asyncHandler(async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "public, max-age=30");
    sendSuccess(res, await promotionService.flash(FlashQuerySchema.parse(req.query).productId));
  });

  public readonly list = asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await promotionService.list());
  });

  public readonly create = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await promotionService.create(PromotionSchema.parse(req.body)), HttpStatus.CREATED);
  });

  public readonly update = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await promotionService.update(parseId(req), UpdatePromotionSchema.parse(req.body)));
  });

  // history => GET /api/v1/promotion/history?orderId= (RF-13.10)
  public readonly history = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await promotionService.history(PromotionHistoryQuerySchema.parse(req.query).orderId));
  });

  // seasonal => POST /api/v1/promotion/seasonal (RF-13.9 crea Black Friday y Cyber Monday del año si faltan)
  public readonly seasonal = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, { created: await promotionService.ensureSeasonalCampaigns(SeasonalSchema.parse(req.body ?? {}).year) }, HttpStatus.CREATED);
  });
}

export const promotionController = new PromotionController();
