// webhook.controller.ts => capa HTTP del módulo Webhooks: valida con Zod y delega en el service (SRP).
import type { Request, Response } from "express";
import { webhookService } from "../service/webhook.service";
import { ExecutionSchema, ListWebhooksQuerySchema, UpdateWebhookSchema, WebhookSchema } from "../schema/webhook.schema";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseObjectId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class WebhookController {
  // POST /api/v1/webhook
  public readonly createWebhook = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await webhookService.createWebhook(WebhookSchema.parse(req.body), currentUser(req).id), HttpStatus.CREATED);
  });

  // GET /api/v1/webhook
  public readonly listWebhooks = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await webhookService.listWebhooks(ListWebhooksQuerySchema.parse(req.query));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  // PATCH /api/v1/webhook/:id
  public readonly updateWebhook = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await webhookService.updateWebhook(parseObjectId(req), UpdateWebhookSchema.parse(req.body)));
  });

  // DELETE /api/v1/webhook/:id
  public readonly deleteWebhookById = asyncHandler(async (req: Request, res: Response) => {
    await webhookService.deleteWebhookById(parseObjectId(req));
    sendNoContent(res);
  });

  // POST /api/v1/webhook/execution { webhookId, payload }
  public readonly createWebhookExecution = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await webhookService.createWebhookExecution(ExecutionSchema.parse(req.body)), HttpStatus.CREATED);
  });
}

export const webhookController = new WebhookController();
