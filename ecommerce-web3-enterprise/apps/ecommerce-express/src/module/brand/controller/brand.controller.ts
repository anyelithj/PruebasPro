// brand.controller.ts => capa HTTP del módulo Brand.
import type { Request, Response } from "express";
import { brandService } from "../service/brand.service";
import { CreateBrandSchema, ListBrandsQuerySchema, UpdateBrandSchema } from "../schema/brand.schema";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId, parseParam } from "../../../shared/pipe/validation.pipe";
import { HttpStatus } from "../../../shared/constants/http.constants";
import { isStaff } from "../../../shared/decorator/auth.decorator";

export class BrandController {
  // listBrands => GET /api/v1/brand?page=&limit=&q=
  public readonly listBrands = asyncHandler(async (req: Request, res: Response) => {
    const includeInactive = req.user !== undefined && isStaff(req.user); // El staff ve también las inactivas
    const { items, meta } = await brandService.listBrands(ListBrandsQuerySchema.parse(req.query), includeInactive);
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  // getBrandById => GET /api/v1/brand/:idOrSlug
  public readonly getBrandById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await brandService.getBrandById(parseParam(req, "id")));
  });

  // getBrandStats => GET /api/v1/brand/:id/stats (RF-05.4, solo ADMIN: ventas globales de todos los vendedores)
  public readonly getBrandStats = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await brandService.getBrandStats(parseParam(req, "id")));
  });

  public readonly createBrand = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await brandService.createBrand(CreateBrandSchema.parse(req.body)), HttpStatus.CREATED);
  });

  public readonly updateBrand = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await brandService.updateBrand(parseId(req), UpdateBrandSchema.parse(req.body)));
  });

  public readonly deleteBrandById = asyncHandler(async (req: Request, res: Response) => {
    await brandService.deleteBrandById(parseId(req));
    sendNoContent(res);
  });
}

export const brandController = new BrandController();
