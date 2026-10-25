// search.route.ts => búsqueda pública (optionalAuth registra historial si hay sesión); historial requiere sesión.
import { Router } from "express";
import { searchController } from "../controller/search.controller";
import { jwtAuthGuard } from "../../auth/guard/auth.guard";
import { optionalAuth } from "../../../shared/middleware/jwt.middleware";
import { rateLimit } from "../../../shared/middleware/rate-limit.middleware";
import { imageUpload } from "../../media/util/image.util";

export const searchRouter = Router();

searchRouter.get("/", optionalAuth, searchController.search);
searchRouter.get("/suggestions", searchController.suggestions);
searchRouter.get("/spelling", searchController.spelling); // RF-06.1 corrección ortográfica (pública)
// Búsqueda visual: costosa (inferencia de IA) => rate limit por IP
searchRouter.post(
  "/image",
  optionalAuth,
  rateLimit({ bucket: "search-image", limit: 20, windowSeconds: 60 }),
  imageUpload.single("file"),
  searchController.searchByImage
);
searchRouter.get("/history", jwtAuthGuard, searchController.recentSearches);
searchRouter.delete("/history", jwtAuthGuard, searchController.clearHistory);
