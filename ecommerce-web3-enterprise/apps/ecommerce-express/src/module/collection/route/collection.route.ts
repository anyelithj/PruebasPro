// collection.route.ts => lecturas públicas (con vista extendida para staff), escrituras con permiso RBAC.
import { Router } from "express";
import { collectionController } from "../controller/collection.controller";
import { jwtAuthGuard } from "../../auth/guard/auth.guard";
import { optionalAuth } from "../../../shared/middleware/jwt.middleware";
import { requirePermission } from "../../../shared/middleware/rbac.middleware";

export const collectionRouter = Router();

collectionRouter.get("/", optionalAuth, collectionController.listCollections);
collectionRouter.get("/:id", optionalAuth, collectionController.getCollectionById);
collectionRouter.post("/", jwtAuthGuard, requirePermission("CREATE", "collection"), collectionController.createCollection);
collectionRouter.patch("/:id", jwtAuthGuard, requirePermission("UPDATE", "collection"), collectionController.updateCollection);
collectionRouter.delete("/:id", jwtAuthGuard, requirePermission("DELETE", "collection"), collectionController.deleteCollectionById);
