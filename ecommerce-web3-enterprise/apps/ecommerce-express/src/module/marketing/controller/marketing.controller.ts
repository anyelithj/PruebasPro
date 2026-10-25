// marketing.controller.ts => capa HTTP del módulo Marketing: valida con Zod y delega en el service (SRP).
import type { Request, Response } from "express";
import { marketingService } from "../service/marketing.service";
import { CampaignSchema, ListCampaignsQuerySchema, UpdateCampaignSchema } from "../schema/marketing.schema";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseObjectId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class MarketingController {
  // POST /api/v1/marketing/campaign => 201 (borrador/programada) | 202 (sendNow: envío en curso)
  public readonly createCampaign = asyncHandler(async (req: Request, res: Response) => {
    const input = CampaignSchema.parse(req.body);
    sendSuccess(res, await marketingService.createCampaign(input, currentUser(req).id), input.sendNow ? HttpStatus.ACCEPTED : HttpStatus.CREATED);
  });

  // GET /api/v1/marketing/campaign?status=&channel=&page=
  public readonly listCampaigns = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await marketingService.listCampaigns(ListCampaignsQuerySchema.parse(req.query));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  // GET /api/v1/marketing/campaign/:id
  public readonly getCampaignById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await marketingService.getCampaignById(parseObjectId(req)));
  });

  // PATCH /api/v1/marketing/campaign/:id
  public readonly updateCampaign = asyncHandler(async (req: Request, res: Response) => {
    const input = UpdateCampaignSchema.parse(req.body);
    sendSuccess(res, await marketingService.updateCampaign(parseObjectId(req), input), input.sendNow ? HttpStatus.ACCEPTED : HttpStatus.OK);
  });

  // DELETE /api/v1/marketing/campaign/:id => archiva
  public readonly deleteCampaignById = asyncHandler(async (req: Request, res: Response) => {
    await marketingService.deleteCampaignById(parseObjectId(req));
    sendNoContent(res);
  });
}

export const marketingController = new MarketingController();
