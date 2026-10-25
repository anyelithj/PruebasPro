// communication.controller.ts => capa HTTP del chat (los mensajes en vivo viajan por Socket.io: communication.event.ts).
import type { Request, Response } from "express";
import { communicationService } from "../service/communication.service";
import { AssignSchema, CannedSchema, ChatwootWebhookSchema, CreateConversationSchema, EscalationSchema, ListConversationsQuerySchema, MetricsQuerySchema, PostMessageSchema } from "../schema/communication.schema";
import { timingSafeEqual } from "node:crypto";
import { contactService } from "../service/contact.service"; // RF-21.2
import { ContactListQuerySchema, ContactSchema, ContactUpdateSchema } from "../schema/communication.schema";
import { buildPaginationMeta, toPageParams } from "../../../shared/util/pagination.util";
import { appConfig } from "../../../config/app.config";
import { UnauthorizedException } from "../../../shared/filter/http-exception.filter";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseObjectId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";
import { requestLocale } from "../../../shared/util/i18n.util";

// sameToken => comparación en tiempo constante (no revela por tiempos cuántos caracteres coinciden)
const sameToken = (given: unknown, expected: string | undefined): boolean => {
  if (!expected || typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

export class CommunicationController {
  // POST /api/v1/communication/contact (público) => RF-21.2 formulario de contacto
  public readonly contact = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as { id?: string } | undefined)?.id ?? null;
    sendSuccess(res, await contactService.create(ContactSchema.parse(req.body), userId), HttpStatus.CREATED);
  });
  public readonly listContact = asyncHandler(async (req: Request, res: Response) => {
    const query = ContactListQuerySchema.parse(req.query);
    const page = toPageParams(query);
    const { items, total } = await contactService.list(query.status, page.page, page.limit);
    sendSuccess(res, items, HttpStatus.OK, buildPaginationMeta(page, total));
  });
  public readonly updateContact = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await contactService.update(parseObjectId(req), ContactUpdateSchema.parse(req.body), currentUser(req).id));
  });

  // POST /api/v1/communication/chatwoot/webhook?token= (RF-17.11 respuestas de agentes y cierres desde Chatwoot)
  public readonly chatwootWebhook = asyncHandler(async (req: Request, res: Response) => {
    if (!sameToken(req.query["token"], appConfig.CHATWOOT_WEBHOOK_TOKEN)) throw new UnauthorizedException("Token de webhook inválido");
    await communicationService.handleChatwootWebhook(ChatwootWebhookSchema.parse(req.body));
    sendSuccess(res, { received: true });
  });

  // POST /api/v1/communication/:id/message (cliente o agente por REST; el chat en vivo usa Socket.io)
  public readonly postMessage = asyncHandler(async (req: Request, res: Response) => {
    const { content } = PostMessageSchema.parse(req.body);
    sendSuccess(res, await communicationService.postMessage(parseObjectId(req), content, currentUser(req), requestLocale(req)), HttpStatus.CREATED);
  });

  // POST /api/v1/communication/:id/assign { assigneeId? } (RF-17.11 manual con id, automática sin id)
  public readonly assign = asyncHandler(async (req: Request, res: Response) => {
    const { assigneeId } = AssignSchema.parse(req.body ?? {});
    sendSuccess(res, await communicationService.assign(parseObjectId(req), currentUser(req), assigneeId));
  });

  // GET /api/v1/communication/support/metrics?days= (RF-17.12)
  public readonly metrics = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await communicationService.metrics(MetricsQuerySchema.parse(req.query).days));
  });

  // GET / POST /api/v1/communication/support/canned (RF-17.11 respuestas rápidas)
  public readonly listCanned = asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await communicationService.cannedResponses());
  });
  public readonly createCanned = asyncHandler(async (req: Request, res: Response) => {
    const { shortCode, content } = CannedSchema.parse(req.body);
    sendSuccess(res, await communicationService.createCannedResponse(shortCode, content), HttpStatus.CREATED);
  });

  // GET /api/v1/communication/support/agents (agentes de Chatwoot para la asignación manual)
  public readonly agents = asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await communicationService.agents());
  });

  // POST /api/v1/communication
  public readonly createConversation = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await communicationService.createConversation(CreateConversationSchema.parse(req.body), currentUser(req), requestLocale(req)), HttpStatus.CREATED);
  });

  // GET /api/v1/communication?channel=&status=
  public readonly listConversations = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await communicationService.listConversations(ListConversationsQuerySchema.parse(req.query), currentUser(req));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  // GET /api/v1/communication/:id
  public readonly getConversationById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await communicationService.getConversationById(parseObjectId(req), currentUser(req)));
  });

  // PATCH /api/v1/communication/:id/escalate
  public readonly updateConversation = asyncHandler(async (req: Request, res: Response) => {
    const { reason } = EscalationSchema.parse(req.body ?? {});
    sendSuccess(res, await communicationService.updateConversation(parseObjectId(req), reason, currentUser(req)));
  });

  // DELETE /api/v1/communication/:id (archivar)
  public readonly deleteConversationById = asyncHandler(async (req: Request, res: Response) => {
    await communicationService.deleteConversationById(parseObjectId(req), currentUser(req));
    sendNoContent(res);
  });
}

export const communicationController = new CommunicationController();
