// automation.controller.ts => capa HTTP del módulo Automation (n8n): valida con Zod y delega en el service.
import type { Request, Response } from "express";
import { automationService } from "../service/automation.service";
import { HealthQuerySchema, ListWorkflowsQuerySchema, NotifyStaffSchema, RollbackSchema, RunSchema, UpdateWorkflowSchema, WhatsAppActionSchema, WorkflowSchema } from "../schema/automation.schema";
import { z } from "zod";

const TemplateKey = z.string().regex(/^[a-z0-9-]{3,60}$/);
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseObjectId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class AutomationController {
  // ---------- RF-20.2 plantillas ----------
  public readonly templates = asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, automationService.templates());
  });
  // GET /api/v1/automation/template/:key => JSON de n8n para importar a mano
  public readonly template = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, automationService.template(TemplateKey.parse(req.params["key"])));
  });
  public readonly installTemplate = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await automationService.installTemplate(TemplateKey.parse(req.params["key"]), currentUser(req).id), HttpStatus.CREATED);
  });

  // ---------- RF-20.7 salud y versiones ----------
  public readonly health = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await automationService.health(HealthQuerySchema.parse(req.query).days));
  });
  public readonly versions = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await automationService.versions(parseObjectId(req)));
  });
  public readonly rollback = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await automationService.rollback(parseObjectId(req), RollbackSchema.parse(req.body).version, currentUser(req).id));
  });

  // ---------- RF-20.6 acciones para n8n ----------
  public readonly whatsappAction = asyncHandler(async (req: Request, res: Response) => {
    const { userId, text } = WhatsAppActionSchema.parse(req.body);
    sendSuccess(res, await automationService.whatsappAction(userId, text));
  });
  public readonly notifyStaff = asyncHandler(async (req: Request, res: Response) => {
    const { title, body } = NotifyStaffSchema.parse(req.body);
    sendSuccess(res, await automationService.notifyStaff(title, body));
  });
  public readonly dispatchCampaigns = asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await automationService.dispatchCampaigns());
  });

  // POST /api/v1/automation
  public readonly createWorkflow = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await automationService.createWorkflow(WorkflowSchema.parse(req.body), currentUser(req).id), HttpStatus.CREATED);
  });

  // GET /api/v1/automation
  public readonly listWorkflows = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await automationService.listWorkflows(ListWorkflowsQuerySchema.parse(req.query));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  // GET /api/v1/automation/:id
  public readonly getWorkflowById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await automationService.getWorkflowById(parseObjectId(req)));
  });

  // PATCH /api/v1/automation/:id
  public readonly updateWorkflow = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await automationService.updateWorkflow(parseObjectId(req), UpdateWorkflowSchema.parse(req.body), currentUser(req).id));
  });

  // DELETE /api/v1/automation/:id
  public readonly deleteWorkflowById = asyncHandler(async (req: Request, res: Response) => {
    await automationService.deleteWorkflowById(parseObjectId(req));
    sendNoContent(res);
  });

  // POST /api/v1/automation/:id/run => 202 Accepted (la ejecución sigue en segundo plano)
  public readonly createWorkflowRun = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await automationService.createWorkflowRun(parseObjectId(req), RunSchema.parse(req.body ?? {}).payload), HttpStatus.ACCEPTED);
  });
}

export const automationController = new AutomationController();
