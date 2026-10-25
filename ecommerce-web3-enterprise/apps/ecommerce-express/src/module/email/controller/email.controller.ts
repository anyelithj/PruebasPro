// email.controller.ts => capa HTTP del módulo Email: valida con Zod y delega en el service (SRP).
import type { Request, Response } from "express";
import { emailService } from "../service/email.service";
import { ClickQuerySchema, PreviewSchema, ListEmailsQuerySchema, SendEmailSchema, TemplateSchema, UpdateTemplateSchema } from "../schema/email.schema";
import { appConfig } from "../../../config/app.config";
import { renderBlocks } from "../util/blocks.util";
import { renderTemplate } from "../util/template.util";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseObjectId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";

// GIF transparente de 1x1 (43 bytes) en base64: respuesta del píxel de tracking (sin leer archivos del disco)
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export class EmailController {
  // POST /api/v1/email/send => 201 (un destinatario, ya enviado) | 202 (varios, en cola)
  public readonly createEmail = asyncHandler(async (req: Request, res: Response) => {
    const result = await emailService.createEmail(SendEmailSchema.parse(req.body), currentUser(req).id);
    sendSuccess(res, result, result.queued > 1 ? HttpStatus.ACCEPTED : HttpStatus.CREATED);
  });

  // GET /api/v1/email?status=&to=&campaignId=&page=
  public readonly listEmails = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await emailService.listEmails(ListEmailsQuerySchema.parse(req.query));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  // GET /api/v1/email/:id
  public readonly getEmailById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await emailService.getEmailById(parseObjectId(req)));
  });

  // GET /api/v1/email/:id/open => píxel público; "no-store" => cada apertura llega al servidor (sin caché)
  public readonly trackOpen = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params["id"] ?? "";
    if (/^[a-f0-9]{24}$/i.test(id)) await emailService.registerOpen(id); // ID inválido => se responde igual (sin pistas)
    res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" }).send(PIXEL);
  });

  // GET /api/v1/email/:id/click?u=&s= (público) => RF-21.5 cuenta el clic y redirige; firma inválida => portada
  public readonly trackClick = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params["id"] ?? "";
    const query = ClickQuerySchema.safeParse(req.query);
    const target = /^[a-f0-9]{24}$/i.test(id) && query.success ? await emailService.registerClick(id, query.data.u, query.data.s) : null;
    res.redirect(302, target ?? appConfig.STORE_URL); // Nunca redirige a un destino no firmado (anti open-redirect)
  });

  // POST /api/v1/email/template/preview => RF-21.6 HTML del diseño con variables de ejemplo (mismo render que el envío)
  public readonly previewTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { blocks, variables, locale } = PreviewSchema.parse(req.body);
    sendSuccess(res, { html: renderTemplate(renderBlocks(blocks, locale), variables, true) });
  });

  // GET /api/v1/email/template
  public readonly listEmailTemplates = asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await emailService.listEmailTemplates());
  });

  // POST /api/v1/email/template
  public readonly createEmailTemplate = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await emailService.createEmailTemplate(TemplateSchema.parse(req.body), currentUser(req).id), HttpStatus.CREATED);
  });

  // PATCH /api/v1/email/template/:id
  public readonly updateEmailTemplate = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await emailService.updateEmailTemplate(parseObjectId(req), UpdateTemplateSchema.parse(req.body)));
  });

  // DELETE /api/v1/email/template/:id
  public readonly deleteEmailTemplateById = asyncHandler(async (req: Request, res: Response) => {
    await emailService.deleteEmailTemplateById(parseObjectId(req));
    sendNoContent(res);
  });
}

export const emailController = new EmailController();
