// coupon.controller.ts => capa HTTP del módulo Coupon.
import type { Request, Response } from "express";
import { couponService } from "../service/coupon.service";
import { CreateCouponSchema, ListCouponsQuerySchema, UpdateCouponSchema, ValidateCouponSchema } from "../schema/coupon.schema";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class CouponController {
  public readonly listCoupons = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await couponService.listCoupons(ListCouponsQuerySchema.parse(req.query));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  public readonly getCouponById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await couponService.getCouponById(parseId(req)));
  });

  public readonly createCoupon = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await couponService.createCoupon(CreateCouponSchema.parse(req.body)), HttpStatus.CREATED);
  });

  public readonly updateCoupon = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await couponService.updateCoupon(parseId(req), UpdateCouponSchema.parse(req.body)));
  });

  public readonly deleteCouponById = asyncHandler(async (req: Request, res: Response) => {
    await couponService.deleteCouponById(parseId(req));
    sendNoContent(res);
  });

  // createCouponValidation => POST /api/v1/coupon/validate
  public readonly validateCoupon = asyncHandler(async (req: Request, res: Response) => {
    const { code, subtotalCents, items } = ValidateCouponSchema.parse(req.body);
    sendSuccess(res, await couponService.validateCoupon(code, subtotalCents, currentUser(req).id, items));
  });
}

export const couponController = new CouponController();
