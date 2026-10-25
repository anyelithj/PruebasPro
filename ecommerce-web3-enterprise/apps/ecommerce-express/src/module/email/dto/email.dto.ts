// email.dto.ts => contratos de salida del módulo Email (SendEmailDto, CreateTemplateDto, UpdateTemplateDto).
import type { EmailStatus } from "../model/email.model";

// EmailLogDto => un envío del historial con su tracking de apertura
export interface EmailLogDto {
  id: string;
  to: string;
  subject: string;
  templateId: string | null;
  campaignId: string | null;
  status: EmailStatus;
  error: string | null;
  sentBy: string | null;
  openCount: number;
  openedAt: Date | null;
  clickCount: number; // RF-21.5
  convertedAt: Date | null;
  revenueCents: number;
  variant: "A" | "B" | null; // RF-21.4
  sentAt: Date | null;
  createdAt: Date;
}

// EmailTemplateDto => plantilla con sus variables detectadas
export interface EmailTemplateDto {
  id: string;
  name: string;
  subject: string;
  html: string;
  text: string | null;
  variables: string[];
  blocks: unknown[] | null; // RF-21.6 diseño visual (null = HTML escrito a mano)
  locale: "es" | "en";
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// SendEmailDto => resultado de POST /email/send (envío individual: el log; masivo: cuántos quedaron en cola)
export interface SendEmailDto {
  queued: number;
  ids: string[];
}

// Recipient => destinatario de un envío masivo con sus variables personalizadas (Marketing)
export interface Recipient {
  to: string;
  variables?: Record<string, string | number>;
}

// BulkResultDto => conteo final de un envío masivo (métricas de campaña)
export interface BulkResultDto {
  sent: number;
  failed: number;
}
