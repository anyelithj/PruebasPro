// mcp.dto.ts => contratos de salida del módulo MCP Server (TransactionDto, RollbackDto, SagaCompensationDto).
import type { StepStatus, TransactionStatus } from "../model/mcp.model";

export interface SagaStepDto {
  name: string;
  input: Record<string, unknown>;
  output: unknown;
  status: StepStatus;
  error: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface SagaLogEntryDto {
  at: Date;
  message: string;
}

// TransactionDto => estado completo de una transacción distribuida
export interface TransactionDto {
  id: string;
  type: string;
  status: TransactionStatus;
  steps: SagaStepDto[];
  log: SagaLogEntryDto[];
  idempotencyKey: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
}

// SagaCompensationDto => resultado del rollback: estado final + pasos compensados
export interface SagaCompensationDto {
  transaction: TransactionDto;
  compensated: number;
}
