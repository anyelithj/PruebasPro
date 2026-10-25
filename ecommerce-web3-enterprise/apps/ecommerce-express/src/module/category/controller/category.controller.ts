// category.controller.ts => capa HTTP del módulo Category (sin lógica de negocio).
import type { Request, Response } from "express";
import { categoryService } from "../service/category.service";
import { CreateCategorySchema, DeleteCategoryQuerySchema, UpdateCategorySchema } from "../schema/category.schema";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId, parseParam } from "../../../shared/pipe/validation.pipe";
import { HttpStatus } from "../../../shared/constants/http.constants";
import { isStaff } from "../../../shared/decorator/auth.decorator";

export class CategoryController {
  // listCategorys => GET /api/v1/category (árbol completo; el staff puede pedir ?all=true para ver inactivas)
  public readonly listCategories = asyncHandler(async (req: Request, res: Response) => {
    const includeInactive = req.query["all"] === "true" && req.user !== undefined && isStaff(req.user);
    sendSuccess(res, await categoryService.listCategories(includeInactive));
  });

  // getCategoryById => GET /api/v1/category/:idOrSlug
  public readonly getCategoryById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await categoryService.getCategoryById(parseParam(req, "id")));
  });

  // createCategory => POST /api/v1/category
  public readonly createCategory = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await categoryService.createCategory(CreateCategorySchema.parse(req.body)), HttpStatus.CREATED);
  });

  // updateCategory => PATCH /api/v1/category/:id
  public readonly updateCategory = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await categoryService.updateCategory(parseId(req), UpdateCategorySchema.parse(req.body)));
  });

  // deleteCategoryById => DELETE /api/v1/category/:id?reassignTo=<uuid>
  public readonly deleteCategoryById = asyncHandler(async (req: Request, res: Response) => {
    const { reassignTo } = DeleteCategoryQuerySchema.parse(req.query);
    await categoryService.deleteCategoryById(parseId(req), reassignTo);
    sendNoContent(res);
  });
}

export const categoryController = new CategoryController();
