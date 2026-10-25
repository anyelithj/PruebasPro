// recommendation.controller.ts => capa HTTP de Recomendaciones IA: valida (Zod) y delega en el service.
import type { Request, Response } from "express";
import { recommendationService } from "../service/recommendation.service";
import { HomeQuerySchema, ListRecommendationsQuerySchema, SessionContextSchema } from "../schema/recommendation.schema";
import { homeFeed } from "../service/home-feed.service"; // RF-18.7
import { deviceContext } from "../../../shared/util/device.util";
import { asyncHandler, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseObjectId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";
import { requestLocale } from "../../../shared/util/i18n.util";

export class RecommendationController {
  // GET /api/v1/recommendation/home?hour=&device=&city= (RF-18.7 portada personalizada; sesión opcional)
  public readonly home = asyncHandler(async (req: Request, res: Response) => {
    const { hour, device, city } = HomeQuerySchema.parse(req.query);
    const userId = (req.user as { id?: string } | undefined)?.id ?? null;
    res.setHeader("Cache-Control", userId ? "private, no-store" : "public, max-age=300"); // Anónimos: caché 5 min por contexto
    sendSuccess(res, await homeFeed(userId, { hour, device, city, country: deviceContext(req).country }));
  });

  // POST /api/v1/recommendation/session
  public readonly createRecommendationSession = asyncHandler(async (req: Request, res: Response) => {
    const dto = await recommendationService.createRecommendationSession(SessionContextSchema.parse(req.body), currentUser(req).id, requestLocale(req));
    sendSuccess(res, dto, HttpStatus.CREATED);
  });

  // GET /api/v1/recommendation
  public readonly listRecommendations = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await recommendationService.listRecommendations(currentUser(req).id, ListRecommendationsQuerySchema.parse(req.query));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  // GET /api/v1/recommendation/:id
  public readonly getRecommendationById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await recommendationService.getRecommendationById(parseObjectId(req), currentUser(req).id));
  });

  // DELETE /api/v1/recommendation/history => 200 con el conteo (el cliente lo muestra en el aviso)
  public readonly deleteAllRecommendations = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await recommendationService.deleteAllRecommendations(currentUser(req).id));
  });
}

export const recommendationController = new RecommendationController();
