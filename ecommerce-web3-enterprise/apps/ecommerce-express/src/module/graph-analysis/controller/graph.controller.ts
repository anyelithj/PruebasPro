// graph.controller.ts => capa HTTP del Análisis Relacional IA: valida con Zod y delega en el service (SRP).
import type { Request, Response } from "express";
import { graphService } from "../service/graph.service";
import { GraphQuerySchema, ListGraphQuerySchema } from "../schema/graph.schema";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId, parseObjectId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";
import { requestLocale } from "../../../shared/util/i18n.util";

export class GraphController {
  // POST /api/v1/product-graph/query
  public readonly createGraphQueryResult = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await graphService.createGraphQueryResult(GraphQuerySchema.parse(req.body), currentUser(req).id, requestLocale(req)), HttpStatus.CREATED);
  });

  // GET /api/v1/product-graph
  public readonly listProductGraphs = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await graphService.listProductGraphs(ListGraphQuerySchema.parse(req.query));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  // GET /api/v1/product-graph/:id/relation (":id" = producto)
  public readonly getProductGraphById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await graphService.getProductGraphById(parseId(req)));
  });

  // DELETE /api/v1/product-graph/:id (":id" = análisis guardado en MongoDB)
  public readonly deleteProductGraphById = asyncHandler(async (req: Request, res: Response) => {
    await graphService.deleteProductGraphById(parseObjectId(req));
    sendNoContent(res);
  });
}

export const graphController = new GraphController();
