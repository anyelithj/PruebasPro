// dashboard.controller.ts => capa HTTP del módulo Admin Dashboard: valida con Zod y delega en el service (SRP).
import type { Request, Response } from "express";
import { dashboardService } from "../service/dashboard.service";
import { KPIQuerySchema, UpdateWidgetSchema, WidgetSchema } from "../schema/dashboard.schema";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseObjectId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class DashboardController {
  // GET /api/v1/dashboard/config
  public readonly listDashboardConfigs = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await dashboardService.listDashboardConfigs(currentUser(req).id));
  });

  // GET /api/v1/dashboard/kpi?from=&to=&realtime=true
  public readonly listDashboardKPIs = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await dashboardService.listDashboardKPIs(KPIQuerySchema.parse(req.query)));
  });

  // GET /api/v1/dashboard/vendor?from=&to= => KPIs del vendedor autenticado (currentUser = dueño de los datos)
  public readonly listVendorKPIs = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await dashboardService.listVendorKPIs(currentUser(req).id, KPIQuerySchema.parse(req.query)));
  });

  // POST /api/v1/dashboard/widget
  public readonly createDashboardWidget = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await dashboardService.createDashboardWidget(currentUser(req).id, WidgetSchema.parse(req.body)), HttpStatus.CREATED);
  });

  // PATCH /api/v1/dashboard/widget/:id
  public readonly updateDashboardWidget = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await dashboardService.updateDashboardWidget(parseObjectId(req), currentUser(req).id, UpdateWidgetSchema.parse(req.body)));
  });

  // DELETE /api/v1/dashboard/widget/:id
  public readonly deleteDashboardWidgetById = asyncHandler(async (req: Request, res: Response) => {
    await dashboardService.deleteDashboardWidgetById(parseObjectId(req), currentUser(req).id);
    sendNoContent(res);
  });
}

export const dashboardController = new DashboardController();
