// cache.handler.ts (Express) => capa HTTP del Cache Service (montada en /api/v1/rt/cache): valida con Zod y delega.
// Solo ADMIN: es un almacén clave-valor genérico; abierto al público sería un vector de abuso de memoria.
// Orden de rutas: "/warmup" antes que "/:id" y DELETE "/" (patrón) antes que DELETE "/:id" (lo exige la matriz).
import { Router, type Request, type Response } from "express";
import { cacheService } from "../service/cache.service";
import { CacheKeySchema, PatternQuerySchema, ReplaceCacheRequestSchema, SetCacheRequestSchema, WarmupRequestSchema } from "../dto/cache.dto";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";
import { Roles } from "../../../shared/constants/roles.constants";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { HttpStatus } from "../../../shared/constants/http.constants";

// keyParam => el ":id" de la matriz es la CLAVE de caché (no un UUID); se valida con el mismo schema del DTO
const keyParam = (req: Request) => CacheKeySchema.parse(req.params["id"]);

export const cacheRouter = Router();
cacheRouter.use(jwtAuthGuard, requireRoles(Roles.ADMIN)); // Guard a nivel de router: aplica a todas las rutas

// POST /api/v1/rt/cache/warmup => createCacheWarmup()
cacheRouter.post(
  "/warmup",
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await cacheService.warmup(WarmupRequestSchema.parse(req.body)), HttpStatus.CREATED);
  })
);

// POST /api/v1/rt/cache => createCacheEntry()
cacheRouter.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await cacheService.set(SetCacheRequestSchema.parse(req.body)), HttpStatus.CREATED);
  })
);

// DELETE /api/v1/rt/cache?pattern=glob => deleteAllCacheEntrys()
cacheRouter.delete(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await cacheService.deletePattern(PatternQuerySchema.parse(req.query).pattern));
  })
);

// GET /api/v1/rt/cache/:id => getCacheEntryById()
cacheRouter.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await cacheService.get(keyParam(req)));
  })
);

// PUT /api/v1/rt/cache/:id => updateCacheEntry()
cacheRouter.put(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await cacheService.replace(keyParam(req), ReplaceCacheRequestSchema.parse(req.body)));
  })
);

// DELETE /api/v1/rt/cache/:id => deleteCacheEntryById()
cacheRouter.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    await cacheService.delete(keyParam(req));
    sendNoContent(res);
  })
);
