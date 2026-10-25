// automation.dto.ts => contratos de salida del módulo Automation (ExecutionStatusDto y flujo con métricas).
import type { AutomationEvent, RunStatus, TriggerType } from "../model/automation.model";

// WorkflowMetricsDto => salud del flujo en los últimos 30 días (tasa de éxito y duración media)
export interface WorkflowMetricsDto {
  runs: number;
  successRate: number;
  avgDurationMs: number;
}

export interface WorkflowDto {
  id: string;
  name: string;
  description: string | null;
  triggerType: TriggerType;
  event: AutomationEvent | null;
  webhookPath: string;
  n8nWorkflowId: string | null;
  active: boolean;
  version: number;
  lastRunAt: Date | null;
  metrics: WorkflowMetricsDto;
  createdAt: Date;
  updatedAt: Date;
}

// ExecutionStatusDto => una ejecución (log auditable)
export interface ExecutionStatusDto {
  id: string;
  workflowId: string;
  trigger: TriggerType;
  status: RunStatus;
  attempts: number;
  durationMs: number;
  httpStatus: number | null;
  error: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}

// WorkflowDetailDto => GET /:id: el flujo con sus últimas ejecuciones
export interface WorkflowDetailDto extends WorkflowDto {
  runs: ExecutionStatusDto[];
}

// WorkflowHealthDto => RF-20.7 salud de un flujo en la ventana pedida
export interface WorkflowHealthDto {
  workflowId: string;
  name: string;
  active: boolean;
  version: number;
  runs: number;
  success: number;
  failed: number;
  running: number;
  successRate: number;
  avgDurationMs: number;
  p95DurationMs: number;
  lastRunAt: Date | null;
  lastError: string | null;
  health: "HEALTHY" | "DEGRADED" | "FAILING" | "IDLE";
}

export interface AutomationHealthDto {
  days: number;
  totals: { runs: number; success: number; failed: number; successRate: number; avgDurationMs: number };
  timeline: Array<{ day: string; success: number; failed: number }>;
  workflows: WorkflowHealthDto[];
}

export interface WorkflowVersionDto {
  version: number;
  snapshot: Record<string, unknown>;
  changedBy: string;
  createdAt: Date;
}
