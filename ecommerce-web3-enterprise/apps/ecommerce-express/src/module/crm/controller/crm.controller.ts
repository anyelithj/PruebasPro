// crm.controller.ts => capa HTTP del módulo CRM: valida con Zod y delega en el service (SRP).
import type { Request, Response } from "express";
import { crmService } from "../service/crm.service";
import { retentionService } from "../service/retention.service"; // RF-18.8 riesgo de abandono y reactivación
import { insightService } from "../service/insight.service"; // RF-22.2/22.4/22.6/22.7/22.8/22.10
import { ChurnQuerySchema, CohortQuerySchema, CustomerSchema, CustomSegmentSchema, ImportCsvSchema, ListCustomersQuerySchema, MergeSchema, SegmentPreviewSchema, UpdateCustomerSchema, UpdateCustomSegmentSchema } from "../schema/crm.schema";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId, parseObjectId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class CrmController {
  // ---------- RF-22.2 segmentos personalizados ----------
  public readonly segments = asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await insightService.segments());
  });
  public readonly createSegment = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await insightService.createSegment(CustomSegmentSchema.parse(req.body), currentUser(req).id), HttpStatus.CREATED);
  });
  public readonly updateSegment = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await insightService.updateSegment(parseObjectId(req), UpdateCustomSegmentSchema.parse(req.body)));
  });
  public readonly deleteSegment = asyncHandler(async (req: Request, res: Response) => {
    await insightService.deleteSegment(parseObjectId(req));
    sendNoContent(res);
  });
  public readonly previewSegment = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await insightService.previewSegment(SegmentPreviewSchema.parse(req.body).rules));
  });
  // ---------- RF-22.6 / 22.7 / 22.8 / 22.10 ----------
  public readonly highValue = asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await insightService.highValue());
  });
  public readonly cohorts = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await insightService.cohorts(CohortQuerySchema.parse(req.query).months));
  });
  public readonly insights = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await insightService.insights(parseId(req)));
  });
  // ---------- RF-22.4 duplicados, fusión e importación ----------
  public readonly duplicates = asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await insightService.duplicates());
  });
  public readonly merge = asyncHandler(async (req: Request, res: Response) => {
    const { primaryId, duplicateId } = MergeSchema.parse(req.body);
    sendSuccess(res, await insightService.merge(primaryId, duplicateId, currentUser(req).id));
  });
  public readonly importCsv = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await insightService.importCsv(ImportCsvSchema.parse(req.body).csv, currentUser(req).id));
  });

  // GET /api/v1/crm/churn?risk=MEDIUM&limit= (RF-18.8 clientes en riesgo de abandono)
  public readonly churn = asyncHandler(async (req: Request, res: Response) => {
    const { risk, limit } = ChurnQuerySchema.parse(req.query);
    sendSuccess(res, await retentionService.churnRisk(limit, risk));
  });

  // POST /api/v1/crm/reactivate (RF-18.8 / RF-20.8 ejecutar ya la reactivación; también corre a diario)
  public readonly reactivate = asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, { contacted: await retentionService.reactivate() });
  });

  // POST /api/v1/crm/customer
  public readonly createCustomer = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await crmService.createCustomer(CustomerSchema.parse(req.body), currentUser(req).id), HttpStatus.CREATED);
  });

  // GET /api/v1/crm/customer?q=&segment=&tag=&archived=&page=
  public readonly listCustomers = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await crmService.listCustomers(ListCustomersQuerySchema.parse(req.query));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  // GET /api/v1/crm/customer/:id
  public readonly getCustomerById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await crmService.getCustomerById(parseId(req)));
  });

  // PATCH /api/v1/crm/customer/:id
  public readonly updateCustomer = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await crmService.updateCustomer(parseId(req), UpdateCustomerSchema.parse(req.body), currentUser(req).id));
  });

  // DELETE /api/v1/crm/customer/:id => archiva
  public readonly deleteCustomerById = asyncHandler(async (req: Request, res: Response) => {
    await crmService.deleteCustomerById(parseId(req));
    sendNoContent(res);
  });
}

export const crmController = new CrmController();
