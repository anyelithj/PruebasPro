// analytics.controller.ts => capa HTTP del módulo Analytics: valida con Zod y delega en el service (SRP).
import type { Request, Response } from "express";
import { analyticsService } from "../service/analytics.service";
import { AlertRuleSchema, AttributionQuerySchema, ExportQuerySchema, HeatmapQuerySchema, ListEventsQuerySchema, MetricQuerySchema, PurgeSchema, RangeQuerySchema, ReportQuerySchema, TrackSchema, UpdateAlertRuleSchema } from "../schema/analytics.schema";
import { advancedAnalyticsService as advanced } from "../service/advanced.service";
import { resolveRange } from "../service/analytics.service";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { parseId, parseObjectId } from "../../../shared/pipe/validation.pipe";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class AnalyticsController {
  // POST /api/v1/analytic/event => 202: el navegador no espera nada más (sendBeacon / keepalive)
  public readonly createAnalyticEvent = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await analyticsService.createAnalyticEvent(TrackSchema.parse(req.body), req.user?.id ?? null), HttpStatus.ACCEPTED);
  });

  // GET /api/v1/analytic/event?type=&userId=&path=&from=&to=&page=
  public readonly listAnalyticEvents = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await analyticsService.listAnalyticEvents(ListEventsQuerySchema.parse(req.query));
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  // DELETE /api/v1/analytic/event?before=2026-01-01 (o en el body)
  public readonly deleteAllAnalyticEvents = asyncHandler(async (req: Request, res: Response) => {
    const { before } = PurgeSchema.parse({ ...req.query, ...(req.body ?? {}) });
    sendSuccess(res, await analyticsService.deleteAllAnalyticEvents(before));
  });

  // GET /api/v1/analytic/metric?from=&to=&granularity=
  public readonly listMetrics = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await analyticsService.listMetrics(MetricQuerySchema.parse(req.query)));
  });

  // GET /api/v1/analytic/report?dimension=&from=&to=&limit=
  public readonly listAnalyticReports = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await analyticsService.listAnalyticReports(ReportQuerySchema.parse(req.query)));
  });

  // GET /api/v1/analytic/export?report=&from=&to=&granularity= (RF-24.6) => archivo CSV descargable
  public readonly exportReport = asyncHandler(async (req: Request, res: Response) => {
    const query = ExportQuerySchema.parse(req.query);
    const rows: Array<Record<string, unknown>> =
      query.report === "metric"
        ? (await analyticsService.listMetrics({ from: query.from, to: query.to, granularity: query.granularity, compare: false })).series.map((point) => ({ ...point }))
        : (await analyticsService.listAnalyticReports({ dimension: query.report, from: query.from, to: query.to, limit: 50 })).rows.map((row) => ({ ...row }));
    // "\uFEFF" (BOM) => Excel abre el CSV con tildes correctas
    res.setHeader("Content-Type", "text/csv; charset=utf-8").setHeader("Content-Disposition", `attachment; filename="reporte-${query.report}.csv"`).send(`\uFEFF${advanced.exportCsv(rows)}`);
  });

  // RF-24.8 mapa de calor y rendimiento
  public readonly heatmap = asyncHandler(async (req: Request, res: Response) => {
    const query = HeatmapQuerySchema.parse(req.query);
    const { from, to } = resolveRange(query);
    sendSuccess(res, await advanced.heatmap(query.path, from, to, query.device));
  });
  public readonly performance = asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = resolveRange(RangeQuerySchema.parse(req.query));
    sendSuccess(res, await advanced.performance(from, to));
  });
  // RF-22.9 recorrido de un cliente · RF-24.11 atribución multitoque · RF-24.12 cripto
  public readonly journey = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await advanced.journey(parseId(req)));
  });
  public readonly attribution = asyncHandler(async (req: Request, res: Response) => {
    const query = AttributionQuerySchema.parse(req.query);
    const { from, to } = resolveRange(query);
    sendSuccess(res, await advanced.attribution(query.model, from, to));
  });
  public readonly crypto = asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = resolveRange(RangeQuerySchema.parse(req.query));
    sendSuccess(res, await advanced.crypto(from, to));
  });
  // RF-24.10 reglas de alerta
  public readonly alertRules = asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await advanced.rules());
  });
  public readonly createAlertRule = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await advanced.createRule(AlertRuleSchema.parse(req.body), currentUser(req).id), HttpStatus.CREATED);
  });
  public readonly updateAlertRule = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await advanced.updateRule(parseObjectId(req), UpdateAlertRuleSchema.parse(req.body)));
  });
  public readonly deleteAlertRule = asyncHandler(async (req: Request, res: Response) => {
    await advanced.deleteRule(parseObjectId(req));
    sendNoContent(res);
  });
}

export const analyticsController = new AnalyticsController();
