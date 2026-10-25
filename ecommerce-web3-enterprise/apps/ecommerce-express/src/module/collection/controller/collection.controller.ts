// collection.controller.ts => capa HTTP del módulo Collection.
import type { Request, Response } from "express";
import { collectionService } from "../service/collection.service";
import { CreateCollectionSchema, UpdateCollectionSchema } from "../schema/collection.schema";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId, parseParam } from "../../../shared/pipe/validation.pipe";
import { HttpStatus } from "../../../shared/constants/http.constants";
import { isStaff } from "../../../shared/decorator/auth.decorator";

// Helper: ¿quien consulta es staff? (ve colecciones programadas o vencidas)
const viewerIsStaff = (req: Request): boolean => req.user !== undefined && isStaff(req.user);

export class CollectionController {
  public readonly listCollections = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await collectionService.listCollections(viewerIsStaff(req)));
  });

  public readonly getCollectionById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await collectionService.getCollectionById(parseParam(req, "id"), viewerIsStaff(req)));
  });

  public readonly createCollection = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await collectionService.createCollection(CreateCollectionSchema.parse(req.body)), HttpStatus.CREATED);
  });

  public readonly updateCollection = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await collectionService.updateCollection(parseId(req), UpdateCollectionSchema.parse(req.body)));
  });

  public readonly deleteCollectionById = asyncHandler(async (req: Request, res: Response) => {
    await collectionService.deleteCollectionById(parseId(req));
    sendNoContent(res);
  });
}

export const collectionController = new CollectionController();
