// dashboard.dto.ts => contratos de salida del módulo Admin Dashboard (CreateWidgetDto, UpdateWidgetDto, KPIQueryDto).
import type { WidgetType } from "../model/dashboard.model";
import type { MetricPointDto, ReportRowDto } from "../../analytics/dto/analytics.dto";

export interface WidgetDto {
  id: string | null; // null => widget del layout por defecto (aún no guardado)
  type: WidgetType;
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, unknown>;
}

// KpiDto => valor del período actual, del anterior y variación (tendencia del KPICard)
export interface KpiDto {
  value: number;
  previous: number;
  change: number; // Variación relativa (0.12 = +12 %); 0 si el período anterior fue 0
}

// KPIQueryDto => GET /dashboard/kpi: todo lo que pinta la portada del panel en UNA petición (menos viajes de red)
export interface KPIQueryDto {
  from: Date;
  to: Date;
  generatedAt: Date;
  kpis: {
    revenueCents: KpiDto;
    orders: KpiDto;
    aovCents: KpiDto;
    newCustomers: KpiDto;
    conversionRate: KpiDto;
  };
  operations: {
    activeOrders: number; // Confirmados, en preparación, empacados o enviados
    pendingRefunds: number; // Devoluciones por revisar
    lowStock: number; // Variantes en alerta de inventario
  };
  series: MetricPointDto[];
  topProducts: ReportRowDto[];
}

// VendorKPIDto => GET /dashboard/vendor: portada del panel del VENDEDOR (solo SUS productos y pedidos)
export interface VendorKPIDto {
  from: Date;
  to: Date;
  kpis: { revenueCents: KpiDto; orders: KpiDto; units: KpiDto }; // Período actual vs. el anterior de igual duración
  products: Record<"DRAFT" | "ACTIVE" | "ARCHIVED", number>; // Su catálogo por estado
  operations: { activeOrders: number; lowStock: number }; // Pedidos por despachar y variantes en alerta
  topProducts: Array<{ name: string; revenueCents: number; units: number }>;
}
