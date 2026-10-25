// dashboard.service.ts => Admin Dashboard (sprint 7.1): KPIs agregados con comparativa contra el período anterior,
// contadores operativos, serie de ventas y productos top en UNA respuesta, más la configuración de widgets por admin.
// Patrones: Facade (orquesta analytics, inventario y contadores sin exponerlos al controller), Aggregate,
// Cache-Aside (60 s en Redis; "realtime=true" lo salta) y Observer (el panel se refresca con los "analytics:tick").
import { dashboardRepository, type DashboardRepository, type WidgetWrite } from "../repository/dashboard.repository";
import { DEFAULT_LAYOUT, MAX_WIDGETS_PER_USER } from "../model/dashboard.model";
import { WidgetLimitException, WidgetNotFoundException } from "../exception/dashboard.exception";
import type { KPIQueryDto, KpiDto, VendorKPIDto, WidgetDto } from "../dto/dashboard.dto";
import type { KPIQuery, UpdateWidgetInput, WidgetInput } from "../schema/dashboard.schema";
import { analyticsService, resolveRange } from "../../analytics/service/analytics.service";
import { periodKey } from "../../analytics/repository/analytics.repository";
import { inventoryService } from "../../inventory/service/inventory.service";
import { cached } from "../../../shared/interceptor/cache.interceptor";
import { RedisKeys } from "../../../config/redis.config";
import { appConfig } from "../../../config/app.config";

const KPI_TTL_SECONDS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

// kpi => valor actual + anterior + variación relativa (función pura)
export function kpi(value: number, previous: number): KpiDto {
  return { value, previous, change: previous > 0 ? Number(((value - previous) / previous).toFixed(4)) : 0 };
}

export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  // listDashboardConfigs => "configuración de widgets del dashboard" (layout por defecto si aún no hay)
  public async listDashboardConfigs(userId: string): Promise<WidgetDto[]> {
    const widgets = await this.repository.findWidgets(userId);
    return widgets.length > 0 ? widgets : DEFAULT_LAYOUT.map((widget) => ({ ...widget, id: null, config: { ...widget.config } }));
  }

  // listDashboardKPIs => "KPIs en tiempo real; query: ?realtime=true"
  public listDashboardKPIs(query: KPIQuery): Promise<KPIQueryDto> {
    const { from, to } = resolveRange({ from: query.from ?? new Date(Date.now() - 7 * DAY_MS), to: query.to });
    const load = () => this.computeKpis(from, to);
    // Sin "realtime" se redondea "to" al minuto en la clave: varios admins comparten la misma entrada de caché
    return query.realtime ? load() : cached(RedisKeys.report("kpi", `${periodKey(from)}:${Math.floor(to.getTime() / 60_000)}`), KPI_TTL_SECONDS, load);
  }

  // listVendorKPIs => portada del VENDEDOR: sus ventas (vs. período anterior), catálogo, despachos y stock crítico.
  // Sin caché: cada vendedor ve solo lo suyo (una entrada por vendedor casi no se reutilizaría) y son COUNT/SUM indexados
  public async listVendorKPIs(vendorId: string, query: KPIQuery): Promise<VendorKPIDto> {
    const { from, to } = resolveRange({ from: query.from ?? new Date(Date.now() - 30 * DAY_MS), to: query.to });
    const prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime())); // Período anterior: mismo largo, justo antes
    // Promise.all => las 6 consultas a la vez (la respuesta tarda lo que la más lenta, no la suma)
    const [sales, prevSales, products, activeOrders, lowStock, topProducts] = await Promise.all([
      this.repository.vendorSales(vendorId, from, to),
      this.repository.vendorSales(vendorId, prevFrom, from),
      this.repository.countVendorProducts(vendorId),
      this.repository.countVendorActiveOrders(vendorId),
      this.repository.countVendorLowStock(vendorId, appConfig.LOW_STOCK_THRESHOLD),
      this.repository.vendorTopProducts(vendorId, from, to),
    ]);
    return {
      from,
      to,
      kpis: { revenueCents: kpi(sales.revenueCents, prevSales.revenueCents), orders: kpi(sales.orders, prevSales.orders), units: kpi(sales.units, prevSales.units) },
      products,
      operations: { activeOrders, lowStock },
      topProducts,
    };
  }

  // createDashboardWidget => "agregar widget al dashboard". La primera personalización materializa el layout por
  // defecto (así agregar un widget no hace desaparecer los que el administrador ya veía)
  public async createDashboardWidget(userId: string, input: WidgetInput): Promise<WidgetDto> {
    const count = await this.repository.countWidgets(userId);
    if (count >= MAX_WIDGETS_PER_USER) throw new WidgetLimitException(MAX_WIDGETS_PER_USER);
    if (count === 0) await Promise.all(DEFAULT_LAYOUT.map((widget) => this.repository.createWidget(userId, { ...widget, config: { ...widget.config } })));
    return this.repository.createWidget(userId, input);
  }

  // updateDashboardWidget => "actualizar posición y/o configuración del widget — PATCH parcial"
  public async updateDashboardWidget(id: string, userId: string, input: UpdateWidgetInput): Promise<WidgetDto> {
    const changes = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as WidgetWrite;
    const updated = await this.repository.updateWidget(id, userId, changes);
    if (!updated) throw new WidgetNotFoundException(id);
    return updated;
  }

  // deleteDashboardWidgetById => "eliminar widget del dashboard"
  public async deleteDashboardWidgetById(id: string, userId: string): Promise<void> {
    if (!(await this.repository.deleteWidget(id, userId))) throw new WidgetNotFoundException(id);
  }

  // computeKpis => período actual vs. el anterior de igual duración; TODAS las consultas en paralelo
  private async computeKpis(from: Date, to: Date): Promise<KPIQueryDto> {
    const span = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - span);
    const prevTo = from;
    const [sales, prevSales, newCustomers, prevNewCustomers, conversion, prevConversion, activeOrders, pendingRefunds, lowStock, series, top] = await Promise.all([
      analyticsService.salesTotals(from, to),
      analyticsService.salesTotals(prevFrom, prevTo),
      this.repository.countNewCustomers(from, to),
      this.repository.countNewCustomers(prevFrom, prevTo),
      analyticsService.conversion(from, to),
      analyticsService.conversion(prevFrom, prevTo),
      this.repository.countActiveOrders(),
      this.repository.countPendingRefunds(),
      inventoryService.countLowStock(),
      analyticsService.salesSeries(from, to, span > 92 * DAY_MS ? "month" : span > 31 * DAY_MS ? "week" : "day"),
      analyticsService.listAnalyticReports({ dimension: "product", from, to, limit: 5 }),
    ]);
    const aov = (totals: { orders: number; revenueCents: number }) => (totals.orders > 0 ? Math.round(totals.revenueCents / totals.orders) : 0);
    return {
      from,
      to,
      generatedAt: new Date(),
      kpis: {
        revenueCents: kpi(sales.revenueCents, prevSales.revenueCents),
        orders: kpi(sales.orders, prevSales.orders),
        aovCents: kpi(aov(sales), aov(prevSales)),
        newCustomers: kpi(newCustomers, prevNewCustomers),
        conversionRate: kpi(conversion, prevConversion),
      },
      operations: { activeOrders, pendingRefunds, lowStock },
      series,
      topProducts: top.rows,
    };
  }
}

export const dashboardService = new DashboardService(dashboardRepository);
