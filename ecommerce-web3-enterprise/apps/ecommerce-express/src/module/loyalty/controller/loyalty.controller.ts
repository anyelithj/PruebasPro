// loyalty.controller.ts => capa HTTP del programa de fidelidad.
import type { Request, Response } from "express";
import { loyaltyService } from "../service/loyalty.service";
import { AdjustPointsSchema, MintBadgeSchema, MultiplierSchema, PersonalShopperSchema, RankingQuerySchema, ShareSchema, TransferBadgeSchema, UpdateMultiplierSchema } from "../schema/loyalty.schema";
import { asyncHandler, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";
import { requestLocale } from "../../../shared/util/i18n.util";

export class LoyaltyController {
  // GET /api/v1/loyalty/me
  public readonly getMyAccount = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await loyaltyService.getMyAccount(currentUser(req).id, requestLocale(req)));
  });

  // RF-14.1 compartir y referir
  public readonly share = asyncHandler(async (req: Request, res: Response) => {
    const { productId, network } = ShareSchema.parse(req.body);
    sendSuccess(res, await loyaltyService.share(currentUser(req).id, productId, network));
  });
  public readonly referral = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await loyaltyService.referralCode(currentUser(req).id));
  });
  // RF-14.9 logros; RF-14.5 ranking; RF-14.4 personal shopper
  public readonly achievements = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await loyaltyService.achievements(currentUser(req).id, requestLocale(req)));
  });
  public readonly ranking = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await loyaltyService.ranking(currentUser(req).id, RankingQuerySchema.parse(req.query).limit));
  });
  public readonly personalShopper = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await loyaltyService.personalShopper(currentUser(req).id, PersonalShopperSchema.parse(req.body).message), HttpStatus.CREATED);
  });
  // RF-14.9 multiplicadores (ADMIN)
  public readonly listMultipliers = asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await loyaltyService.listMultipliers());
  });
  public readonly createMultiplier = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await loyaltyService.createMultiplier(MultiplierSchema.parse(req.body)), HttpStatus.CREATED);
  });
  public readonly updateMultiplier = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await loyaltyService.updateMultiplier(parseId(req), UpdateMultiplierSchema.parse(req.body).isActive));
  });
  // RF-14.8 transferir insignia (registro + verificación on-chain)
  public readonly transferBadge = asyncHandler(async (req: Request, res: Response) => {
    const { toAddress, txHash } = TransferBadgeSchema.parse(req.body);
    sendSuccess(res, await loyaltyService.transferBadge(parseId(req), parseId(req, "badgeId"), currentUser(req), toAddress, txHash));
  });

  // getLoyaltyAccountById => GET /api/v1/loyalty/:id
  public readonly getLoyaltyAccountById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await loyaltyService.getLoyaltyAccountById(parseId(req), currentUser(req), requestLocale(req)));
  });

  // updateLoyaltyAccount => PATCH /api/v1/loyalty/:id/point
  public readonly adjustPoints = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await loyaltyService.adjustPoints(parseId(req), AdjustPointsSchema.parse(req.body), requestLocale(req)));
  });

  // deleteAllLoyaltyAccounts => DELETE /api/v1/loyalty/expired-point
  public readonly purgeExpiredPoints = asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await loyaltyService.purgeExpiredPoints());
  });

  // listNFTBadges => GET /api/v1/loyalty/:id/badge
  public readonly listBadges = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await loyaltyService.listBadges(parseId(req), currentUser(req)));
  });

  // createNFTBadge => POST /api/v1/loyalty/:id/badge/mint
  public readonly mintBadge = asyncHandler(async (req: Request, res: Response) => {
    const { tier } = MintBadgeSchema.parse(req.body ?? {});
    sendSuccess(res, await loyaltyService.mintBadgeFor(parseId(req), currentUser(req), tier), HttpStatus.CREATED);
  });
}

export const loyaltyController = new LoyaltyController();
