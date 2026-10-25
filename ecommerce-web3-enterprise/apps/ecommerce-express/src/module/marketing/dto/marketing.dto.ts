// marketing.dto.ts => contratos de salida del módulo Marketing (CreateCampaignDto / UpdateCampaignDto se infieren de
// marketing.schema.ts; aquí la campaña con sus métricas de rendimiento).
import type { Audience, CampaignStatus, Channel } from "../model/marketing.model";

// CampaignMetricsDto => rendimiento: alcance, enviados, fallidos, abiertos y tasa de apertura (solo email)
export interface CampaignMetricsDto {
  targeted: number;
  sent: number;
  failed: number;
  opened: number;
  openRate: number;
  clicked: number; // RF-21.5
  clickRate: number;
  conversions: number;
  revenueCents: number; // Ventas atribuidas (clic de correo o UTM de la campaña)
  roi: number | null; // RF-24.3 (ingresos - costo) / costo; null sin costo registrado
}

export interface CampaignDto {
  id: string;
  name: string;
  channel: Channel;
  audience: Audience;
  subject: string;
  content: string;
  templateId: string | null;
  url: string | null;
  status: CampaignStatus;
  scheduledAt: Date | null;
  sentAt: Date | null;
  metrics: CampaignMetricsDto;
  costCents: number;
  abTest: { subjectB: string; contentB: string | null; testPercent: number; metric: "OPEN" | "CLICK"; waitHours: number; decideAt: Date | null; winner: "A" | "B" | null; results?: Record<"A" | "B", { sent: number; opened: number; clicked: number }> } | null;
  error: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
