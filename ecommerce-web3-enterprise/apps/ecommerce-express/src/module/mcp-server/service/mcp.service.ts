// mcp.service.ts => transacciones distribuidas de operaciones críticas (sprint 7.2): registra la operación, la ejecuta
// como saga orquestada (mcp.saga.ts), compensa automáticamente ante un fallo y permite rollback manual.
// Patrones: Mediator (el servicio coordina inventario y notificaciones sin que se conozcan), Saga, State e
// Idempotency Key (el mismo idempotencyKey devuelve la transacción existente: reintentos del cliente seguros).
import { mcpRepository, type McpRepository } from "../repository/mcp.repository";
import { sagaOrchestrator, validateStep, type SagaOrchestrator } from "../saga/mcp.saga";
import { InvalidSagaStepException, InvalidTransactionStateException, McpTransactionNotFoundException } from "../exception/mcp.exception";
import type { SagaCompensationDto, SagaStepDto, TransactionDto } from "../dto/mcp.dto";
import type { ListTransactionsQuery, TransactionInput } from "../schema/mcp.schema";
import { buildPaginationMeta, toPageParams } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";

export class McpService {
  constructor(
    private readonly repository: McpRepository,
    private readonly orchestrator: SagaOrchestrator
  ) {}

  // createMCPTransaction => "transacción MCP — registrar operación crítica distribuida" y ejecutarla
  public async createMCPTransaction(input: TransactionInput, actorId: string): Promise<{ transaction: TransactionDto; created: boolean }> {
    if (input.idempotencyKey) {
      const existing = await this.repository.findByIdempotencyKey(input.idempotencyKey);
      if (existing) return { transaction: existing, created: false };
    }
    // Validación previa de TODOS los pasos: si uno es inválido no se ejecuta ninguno (fail fast, sin compensaciones)
    const steps: SagaStepDto[] = input.steps.map((step) => {
      const result = validateStep(step.name, step.input);
      if (!result.ok) throw new InvalidSagaStepException(step.name, result.error);
      return { name: step.name, input: result.input, output: null, status: "PENDING", error: null, startedAt: null, finishedAt: null };
    });
    const transaction = await this.repository.create({ type: input.type, steps, idempotencyKey: input.idempotencyKey, createdBy: actorId });
    const outcome = await this.orchestrator.run(steps, { transactionId: transaction.id, actorId }, this.repository.journal(transaction.id));
    const message = { COMPLETED: "Transacción completada", COMPENSATED: "Paso fallido: transacción compensada", FAILED: "Compensación incompleta: revisar manualmente" }[outcome];
    const final = await this.repository.transition(transaction.id, ["RUNNING"], outcome, message);
    return { transaction: final ?? transaction, created: true };
  }

  // listMCPTransactions => "listar estados de transacciones activas" (filtro opcional por estado)
  public async listMCPTransactions(query: ListTransactionsQuery): Promise<{ items: TransactionDto[]; meta: PaginationMeta }> {
    const page = toPageParams(query);
    const { items, total } = await this.repository.findMany(query.status, page);
    return { items, meta: buildPaginationMeta(page, total) };
  }

  // getMCPTransactionById => "estado detallado de transacción por ID" (pasos + bitácora)
  public async getMCPTransactionById(id: string): Promise<TransactionDto> {
    const transaction = await this.repository.findById(id);
    if (!transaction) throw new McpTransactionNotFoundException(id);
    return transaction;
  }

  // deleteMCPTransactionById => "cancelar y eliminar transacción" (nunca mientras se ejecuta o compensa)
  public async deleteMCPTransactionById(id: string): Promise<void> {
    const transaction = await this.getMCPTransactionById(id);
    if (transaction.status === "RUNNING" || transaction.status === "COMPENSATING") throw new InvalidTransactionStateException(transaction.status, "eliminar");
    await this.repository.delete(id);
  }

  // createSagaCompensation => "ejecutar compensación Saga — desencadena acciones compensatorias" (solo COMPLETED)
  public async createSagaCompensation(id: string, reason: string, actorId: string): Promise<SagaCompensationDto> {
    const current = await this.getMCPTransactionById(id);
    // Transición atómica COMPLETED -> COMPENSATING: un segundo rollback simultáneo recibe 409
    const locked = await this.repository.transition(id, ["COMPLETED"], "COMPENSATING", `Rollback solicitado: ${reason}`);
    if (!locked) throw new InvalidTransactionStateException(current.status, "compensar");
    const steps = locked.steps;
    const before = steps.filter((step) => step.status === "DONE").length;
    const ok = await this.orchestrator.compensate(steps, { transactionId: id, actorId }, this.repository.journal(id));
    const final = await this.repository.transition(id, ["COMPENSATING"], ok ? "COMPENSATED" : "FAILED", ok ? "Rollback completado" : "Rollback incompleto: revisar manualmente");
    return { transaction: final ?? locked, compensated: before - steps.filter((step) => step.status === "DONE").length };
  }
}

export const mcpService = new McpService(mcpRepository, sagaOrchestrator);
