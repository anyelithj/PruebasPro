// supplier.controller.ts => capa HTTP del módulo Suppliers: valida con Zod y delega en el service (SRP).
import type { Request, Response } from "express";
import { supplierService } from "../service/supplier.service";
import { ListSuppliersQuerySchema, SupplierSchema, UpdateSupplierSchema } from "../schema/supplier.schema";
import { asyncHandler, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId } from "../../../shared/pipe/validation.pipe";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class SupplierController {
  // POST /api/v1/supplier
  public readonly createSupplier = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await supplierService.createSupplier(SupplierSchema.parse(req.body)), HttpStatus.CREATED);
  });

  // GET /api/v1/supplier?q=&active=&page=
  public readonly listSuppliers = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await supplierService.listSuppliers(ListSuppliersQuerySchema.parse(req.query));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  // GET /api/v1/supplier/:id
  public readonly getSupplierById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await supplierService.getSupplierById(parseId(req)));
  });

  // PATCH /api/v1/supplier/:id
  public readonly updateSupplier = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await supplierService.updateSupplier(parseId(req), UpdateSupplierSchema.parse(req.body)));
  });

  // DELETE /api/v1/supplier/:id => desactiva y devuelve el proveedor (200: el registro sigue existiendo)
  public readonly deleteSupplierById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await supplierService.deleteSupplierById(parseId(req)));
  });
}

export const supplierController = new SupplierController();
