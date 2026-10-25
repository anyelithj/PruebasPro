// audit.controller.ts => capa HTTP del módulo Audit Logs: valida con Zod y delega en el service (SRP, N-Layer).
import type { Request, Response } from "express";
import { auditService } from "../service/audit.service";
import { auditInsightService } from "../service/audit-insight.service"; // RF-30.3 / 30.4 / 30.7
import { auditRepository } from "../repository/audit.repository";
import { AuditEventSchema, ExportQuerySchema, ListAuditQuerySchema, ReportQuerySchema, RetentionSchema, ReviewSchema } from "../schema/audit.schema";
import { asyncHandler, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseObjectId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class AuditController {
  // POST /api/v1/audit/log => registro de un servicio externo (n8n, FastAPI) con token de administrador
  public readonly createAuditLog = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await auditService.createAuditLog(AuditEventSchema.parse(req.body), currentUser(req), req.ip ?? null), HttpStatus.CREATED);
  });

  // GET /api/v1/audit/log?actorId=&module=&action=&severity=&reviewed=&from=&to=&page=
  public readonly listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await auditService.listAuditLogs(ListAuditQuerySchema.parse(req.query));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  // GET /api/v1/audit/log/export?format=csv|pdf&<mismos filtros> => RF-30.3 descarga del registro filtrado
  public readonly exportAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const { format, max, ...filters } = ExportQuerySchema.parse(req.query); // "rest" => separa formato de los filtros
    const rows = await auditRepository.findForExport(filters, max);
    const name = `auditoria-${new Date().toISOString().slice(0, 10)}`;
    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf").setHeader("Content-Disposition", `attachment; filename="${name}.pdf"`).send(await auditInsightService.toPdf(rows, filters));
      return;
    }
    // BOM => Excel abre el CSV en UTF-8 (tildes y ñ correctas)
    res.setHeader("Content-Type", "text/csv; charset=utf-8").setHeader("Content-Disposition", `attachment; filename="${name}.csv"`).send(`\uFEFF${auditInsightService.toCsv(rows)}`);
  });

  // GET /api/v1/audit/compliance?from=&to=&format=json|pdf => RF-30.7 reporte de cumplimiento con controles
  public readonly complianceReport = asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = ReportQuerySchema.parse(req.query);
    const end = to ?? new Date();
    const report = await auditInsightService.compliance(from ?? new Date(end.getTime() - 30 * 86_400_000), end);
    if (req.query["format"] !== "pdf") return void sendSuccess(res, report);
    res.setHeader("Content-Type", "application/pdf").setHeader("Content-Disposition", `attachment; filename="cumplimiento-${end.toISOString().slice(0, 10)}.pdf"`).send(await auditInsightService.compliancePdf(report));
  });

  // POST /api/v1/audit/anomaly/scan => RF-30.4 detección bajo demanda (el job corre cada 10 min)
  public readonly scanAnomalies = asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, { fired: await auditInsightService.scanAnomalies() });
  });

  // PATCH /api/v1/audit/log/:id { reviewed }
  public readonly updateAuditLog = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await auditService.updateAuditLog(parseObjectId(req), ReviewSchema.parse(req.body ?? {}).reviewed, currentUser(req).id));
  });

  // DELETE /api/v1/audit/log?olderThanDays=90 (también acepta el valor en el body)
  public readonly deleteAllAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const { olderThanDays } = RetentionSchema.parse({ ...req.query, ...(req.body ?? {}) });
    sendSuccess(res, await auditService.deleteAllAuditLogs(olderThanDays));
  });

  // GET /api/v1/audit/report?from=&to=
  public readonly listAuditReports = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await auditService.listAuditReports(ReportQuerySchema.parse(req.query)));
  });
}

export const auditController = new AuditController();
