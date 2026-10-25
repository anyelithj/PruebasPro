// social.controller.ts => capa HTTP de Social Commerce: validación Zod y delegación al service (SRP).
import type { Request, Response } from "express";
import { ingestComments, socialService, socialSentiment } from "../service/social.service";
import { IngestCommentsSchema, SentimentQuerySchema, ListSocialQuerySchema, PublishSchema, UpdatePublishSchema } from "../schema/social.schema";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseObjectId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";
import { CatalogSyncSchema, LiveListQuerySchema, LiveSchema, UgcImportSchema, UgcModerationSchema, UgcQueueQuerySchema, UgcSchema, UpdateLiveSchema } from "../schema/social.schema";
import { channelService } from "../service/channel.service";
import { verifyTikTokWebhook } from "../provider/catalog.provider";
import { appConfig } from "../../../config/app.config";
import { UnauthorizedException } from "../../../shared/filter/http-exception.filter";
import { engagementService } from "../service/engagement.service";
import { buildPaginationMeta, toPageParams } from "../../../shared/util/pagination.util";
import { prisma } from "../../../config/database.config";
import { z } from "zod";

const ProductQuery = z.object({ productId: z.string().uuid() });

export class SocialController {
  // ---------- RF-19.1 / 19.7 / 19.10 canales ----------
  // GET /api/v1/social/channel => estado de Meta y TikTok Shop (configurado, SKU publicadas, errores)
  public readonly channelStatus = asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await channelService.status());
  });
  // POST /api/v1/social/channel/sync { channels? } => publica/actualiza el catálogo (también corre cada hora)
  public readonly syncCatalog = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await channelService.syncCatalog(CatalogSyncSchema.parse(req.body ?? {}).channels));
  });

  // ---------- RF-19.3 webhooks de pedidos (cuerpo crudo) ----------
  // GET /webhook/channel/meta?hub.mode=subscribe&hub.verify_token=&hub.challenge= (alta de la suscripción en Meta)
  public readonly metaVerify = asyncHandler(async (req: Request, res: Response) => {
    const ok = req.query["hub.mode"] === "subscribe" && Boolean(appConfig.META_WEBHOOK_VERIFY_TOKEN) && req.query["hub.verify_token"] === appConfig.META_WEBHOOK_VERIFY_TOKEN;
    if (!ok) throw new UnauthorizedException("Token de verificación inválido");
    res.status(200).send(String(req.query["hub.challenge"] ?? ""));
  });
  public readonly metaWebhook = asyncHandler(async (req: Request, res: Response) => {
    const raw = req.body as Buffer;
    if (!channelService.verifyMeta(raw, req.header("x-hub-signature-256"))) throw new UnauthorizedException("Firma de Meta inválida");
    sendSuccess(res, { imported: await channelService.handleMetaWebhook(JSON.parse(raw.toString("utf8"))) });
  });
  public readonly tiktokWebhook = asyncHandler(async (req: Request, res: Response) => {
    const raw = (req.body as Buffer).toString("utf8");
    if (!verifyTikTokWebhook(raw, req.header("authorization"))) throw new UnauthorizedException("Firma de TikTok inválida");
    sendSuccess(res, { imported: await channelService.handleTikTokWebhook(JSON.parse(raw)) });
  });

  // ---------- RF-19.9 Live Shopping ----------
  public readonly lives = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await engagementService.lives(LiveListQuerySchema.parse(req.query).status));
  });
  public readonly live = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await engagementService.live(parseObjectId(req)));
  });
  public readonly createLive = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await engagementService.createLive(LiveSchema.parse(req.body), currentUser(req)), HttpStatus.CREATED);
  });
  public readonly updateLive = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await engagementService.updateLive(parseObjectId(req), UpdateLiveSchema.parse(req.body), currentUser(req)));
  });
  public readonly deleteLive = asyncHandler(async (req: Request, res: Response) => {
    await engagementService.deleteLive(parseObjectId(req));
    sendNoContent(res);
  });
  public readonly liveClick = asyncHandler(async (req: Request, res: Response) => {
    await engagementService.trackLiveClick(parseObjectId(req));
    sendNoContent(res);
  });

  // ---------- RF-19.11 UGC ----------
  // GET /api/v1/social/ugc?productId= (público: solo aprobados)
  public readonly ugc = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await engagementService.ugcForProduct(ProductQuery.parse(req.query).productId));
  });
  // POST /api/v1/social/ugc (cliente autenticado; queda en moderación)
  public readonly submitUgc = asyncHandler(async (req: Request, res: Response) => {
    const viewer = currentUser(req);
    const user = await prisma.user.findUnique({ where: { id: viewer.id }, select: { firstName: true, lastName: true } });
    const name = user ? `${user.firstName} ${user.lastName.charAt(0)}.`.trim() : "Cliente"; // Nombre abreviado (privacidad)
    sendSuccess(res, await engagementService.submitUgc(UgcSchema.parse(req.body), { ...viewer, name }), HttpStatus.CREATED);
  });
  public readonly ugcQueue = asyncHandler(async (req: Request, res: Response) => {
    const query = UgcQueueQuerySchema.parse(req.query);
    const page = toPageParams(query);
    const { items, total } = await engagementService.ugcQueue(query.status, page.page, page.limit);
    sendSuccess(res, items, HttpStatus.OK, buildPaginationMeta(page, total));
  });
  public readonly moderateUgc = asyncHandler(async (req: Request, res: Response) => {
    await engagementService.moderateUgc(parseObjectId(req), UgcModerationSchema.parse(req.body).status);
    sendNoContent(res);
  });
  public readonly importUgc = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await engagementService.importInstagramMentions(UgcImportSchema.parse(req.body)));
  });

  // POST /api/v1/social/publish
  public readonly createSocialPost = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await socialService.createSocialPost(PublishSchema.parse(req.body), currentUser(req)), HttpStatus.CREATED);
  });

  // PATCH /api/v1/social/publish/:id
  public readonly updateSocialPost = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await socialService.updateSocialPost(parseObjectId(req), UpdatePublishSchema.parse(req.body), currentUser(req)));
  });

  // DELETE /api/v1/social/publish/:id
  public readonly deleteSocialPostById = asyncHandler(async (req: Request, res: Response) => {
    await socialService.deleteSocialPostById(parseObjectId(req), currentUser(req));
    sendNoContent(res);
  });

  // GET /api/v1/social/product (feed público). Cache-Control: el CDN/Nginx sirve el feed 30 s sin tocar MongoDB
  public readonly listSocialProducts = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await socialService.listSocialProducts(ListSocialQuerySchema.parse(req.query));
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  // GET /api/v1/social/product/:id (detalle de la publicación con sus productos y métricas)
  public readonly getSocialProduct = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await socialService.getSocialProduct(parseObjectId(req), req.user));
  });

  // GET /api/v1/social/analytic
  // RF-15.11 ingesta de comentarios y análisis de sentimiento (staff)
  public readonly ingestComments = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await ingestComments(IngestCommentsSchema.parse(req.body)), HttpStatus.CREATED);
  });
  public readonly sentiment = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await socialSentiment(SentimentQuerySchema.parse(req.query).days));
  });

  public readonly listSocialAnalytics = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await socialService.listSocialAnalytics(currentUser(req)));
  });
}

export const socialController = new SocialController();
