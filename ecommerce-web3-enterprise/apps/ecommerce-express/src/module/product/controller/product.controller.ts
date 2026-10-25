// product.controller.ts => capa HTTP del módulo Product.
import type { Request, Response } from "express";
import { productService } from "../service/product.service";
import {
  BulkUpdateProductsSchema,
  CreateProductSchema,
  DeleteAllProductsSchema,
  ExportProductsQuerySchema,
  ListProductsQuerySchema,
  UpdateProductSchema,
} from "../schema/product.schema";
import { BadRequestException } from "../../../shared/filter/http-exception.filter";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId, parseParam } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class ProductController {
  // listProducts => GET /api/v1/product?category=&brand=&collection=&minPrice=&maxPrice=&inStock=&sort=&page=&limit=
  public readonly listProducts = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await productService.listProducts(ListProductsQuerySchema.parse(req.query), req.user);
    // Cache HTTP para CDN/navegador en respuestas públicas (stale-while-revalidate => respuesta instantánea)
    if (!req.user) res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  // getProductById => GET /api/v1/product/:idOrSlug
  public readonly getProductById = asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.getProductById(parseParam(req, "id"), req.user);
    if (!req.user) res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    sendSuccess(res, product);
  });

  // createProduct => POST /api/v1/product
  public readonly createProduct = asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.createProduct(CreateProductSchema.parse(req.body), currentUser(req));
    sendSuccess(res, product, HttpStatus.CREATED);
  });

  // updateProduct => PATCH /api/v1/product/:id
  public readonly updateProduct = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await productService.updateProduct(parseId(req), UpdateProductSchema.parse(req.body), currentUser(req)));
  });

  // deleteProductById => DELETE /api/v1/product/:id (archivar)
  public readonly deleteProductById = asyncHandler(async (req: Request, res: Response) => {
    await productService.deleteProductById(parseId(req), currentUser(req));
    sendNoContent(res);
  });

  // duplicateProduct => POST /api/v1/product/:id/duplicate (RF-04.3)
  public readonly duplicateProduct = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await productService.duplicateProduct(parseId(req), currentUser(req)), HttpStatus.CREATED);
  });

  // bulkUpdateProducts => PATCH /api/v1/product/bulk (RF-04.3 edición en lote)
  public readonly bulkUpdateProducts = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await productService.bulkUpdateProducts(BulkUpdateProductsSchema.parse(req.body), currentUser(req)));
  });

  // exportProducts => GET /api/v1/product/export?format=xlsx|csv (RF-04.3): descarga del archivo (attachment)
  public readonly exportProducts = asyncHandler(async (req: Request, res: Response) => {
    const file = await productService.exportProducts(ExportProductsQuerySchema.parse(req.query), currentUser(req));
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(file.buffer); // Binario tal cual (no pasa por el sobre JSON de sendSuccess)
  });

  // importProducts => POST /api/v1/product/import (multipart "file": .xlsx o .csv) (RF-04.3)
  public readonly importProducts = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new BadRequestException("Adjunta un archivo .xlsx o .csv en el campo \"file\"");
    sendSuccess(res, await productService.importProducts(req.file.buffer, currentUser(req)));
  });

  // deleteAllProducts => DELETE /api/v1/product (body: { ids })
  public readonly deleteAllProducts = asyncHandler(async (req: Request, res: Response) => {
    const { ids } = DeleteAllProductsSchema.parse(req.body);
    sendSuccess(res, await productService.deleteAllProducts(ids, currentUser(req)));
  });
}

export const productController = new ProductController();
