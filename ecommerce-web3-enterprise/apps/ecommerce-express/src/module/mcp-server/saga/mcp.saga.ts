// mcp.saga.ts => catálogo de PASOS de saga y orquestador con compensación (sprint 7.2).
// Patrones: Saga orquestada (un coordinador ejecuta los pasos en orden y, si uno falla, ejecuta las compensaciones
// de los ya hechos en orden INVERSO), Command (cada paso = execute + compensate) y Registry (pasos por nombre: OCP,
// agregar una operación crítica = agregar una entrada, sin tocar el orquestador).
// Cada paso es local y atómico (una sentencia SQL con guarda); la saga da consistencia ENTRE pasos sin 2PC.
import { z, type ZodType } from "zod";
import { inventoryService } from "../../inventory/service/inventory.service";
import { notificationService } from "../../notification/service/notification.service";
import type { SagaStepDto } from "../dto/mcp.dto";

// SagaContext => datos de la transacción disponibles para cada paso (referencia en los movimientos de stock)
export interface SagaContext {
  transactionId: string;
  actorId: string;
}

// SagaStep => contrato de un paso. "compensate" ausente => paso sin efecto que deshacer (ej. una notificación)
export interface SagaStep<Input> {
  schema: ZodType<Input>;
  execute(input: Input, context: SagaContext): Promise<unknown>;
  compensate?(input: Input, output: unknown, context: SagaContext): Promise<void>;
}

// step => helper genérico que conserva el tipo de la entrada entre schema, execute y compensate (tipado seguro)
const step = <Input>(definition: SagaStep<Input>): SagaStep<Input> => definition;

const VariantQuantity = z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(100_000) });

// SAGA_STEPS => registro de operaciones críticas disponibles para las transacciones MCP
export const SAGA_STEPS = {
  // Apartar unidades (como un checkout) <-> liberarlas
  "inventory.reserve": step({
    schema: VariantQuantity,
    execute: ({ variantId, quantity }) => inventoryService.reserve(variantId, quantity),
    compensate: ({ variantId, quantity }) => inventoryService.release(variantId, quantity),
  }),
  "inventory.release": step({
    schema: VariantQuantity,
    execute: ({ variantId, quantity }) => inventoryService.release(variantId, quantity),
    compensate: async ({ variantId, quantity }) => inventoryService.reserve(variantId, quantity),
  }),
  // Entrada/salida de stock con movimiento auditable <-> anulación del movimiento (delta inverso)
  "inventory.adjust": step({
    schema: z.object({ variantId: z.string().uuid(), delta: z.number().int().min(-100_000).max(100_000).refine((value) => value !== 0, "delta no puede ser 0"), reason: z.string().trim().min(3).max(200) }),
    execute: async ({ variantId, delta, reason }, context) => {
      const result = await inventoryService.move({ variantId, type: delta > 0 ? "IN" : "OUT", delta, quantity: Math.abs(delta), reason, reference: `mcp:${context.transactionId}` }, context.actorId);
      return { movementId: result.movement.id, stockAfter: result.level.stock };
    },
    compensate: async (_input, output, context) => {
      await inventoryService.deleteStockMovementById((output as { movementId: string }).movementId, context.actorId);
    },
  }),
  // Aviso in-app a un usuario (sin compensación: un aviso enviado no se "desenvía")
  "notification.send": step({
    schema: z.object({ userId: z.string().uuid(), title: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(500) }),
    execute: ({ userId, title, body }) => notificationService.notify(userId, { type: "SYSTEM", message: { title, body }, channels: ["IN_APP"] }),
  }),
};

export type SagaStepName = keyof typeof SAGA_STEPS;
export const SAGA_STEP_NAMES = Object.keys(SAGA_STEPS) as [SagaStepName, ...SagaStepName[]];

// Puerto de persistencia que el orquestador usa para guardar el avance de cada paso (DIP: no conoce Mongoose)
export interface SagaJournal {
  saveStep(index: number, step: SagaStepDto, message: string): Promise<void>;
}

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 300);

// lookup => paso del registro por nombre (el schema de la API ya garantiza que el nombre existe)
const lookup = (name: string) => SAGA_STEPS[name as SagaStepName] as unknown as SagaStep<Record<string, unknown>>;

export class SagaOrchestrator {
  // run => ejecuta los pasos en orden; ante el primer fallo compensa los hechos y devuelve el estado final
  public async run(steps: SagaStepDto[], context: SagaContext, journal: SagaJournal): Promise<"COMPLETED" | "COMPENSATED" | "FAILED"> {
    for (const [index, current] of steps.entries()) {
      const startedAt = new Date();
      try {
        const output = await lookup(current.name).execute(current.input, context);
        steps[index] = { ...current, status: "DONE", output: output ?? null, startedAt, finishedAt: new Date() };
        await journal.saveStep(index, steps[index], `Paso ${index + 1} (${current.name}) completado`);
      } catch (error) {
        steps[index] = { ...current, status: "FAILED", error: describe(error), startedAt, finishedAt: new Date() };
        await journal.saveStep(index, steps[index], `Paso ${index + 1} (${current.name}) falló: ${describe(error)}`);
        return (await this.compensate(steps, context, journal)) ? "COMPENSATED" : "FAILED";
      }
    }
    return "COMPLETED";
  }

  // compensate => deshace los pasos DONE en orden inverso; true si todas las compensaciones funcionaron
  public async compensate(steps: SagaStepDto[], context: SagaContext, journal: SagaJournal): Promise<boolean> {
    let ok = true;
    // "[...steps.entries()].reverse()" => recorre del último al primero conservando el índice original
    for (const [index, current] of [...steps.entries()].reverse()) {
      if (current.status !== "DONE") continue;
      const definition = lookup(current.name);
      if (!definition.compensate) {
        steps[index] = { ...current, status: "SKIPPED" };
        await journal.saveStep(index, steps[index], `Paso ${index + 1} (${current.name}) sin compensación`);
        continue;
      }
      try {
        await definition.compensate(current.input, current.output, context);
        steps[index] = { ...current, status: "COMPENSATED" };
        await journal.saveStep(index, steps[index], `Paso ${index + 1} (${current.name}) compensado`);
      } catch (error) {
        ok = false; // Se sigue con el resto: compensar lo máximo posible y dejar constancia del fallo
        steps[index] = { ...current, error: describe(error) };
        await journal.saveStep(index, steps[index], `Compensación del paso ${index + 1} (${current.name}) falló: ${describe(error)}`);
      }
    }
    return ok;
  }
}

// validateStep => valida la entrada de un paso con SU schema; devuelve el error legible o la entrada normalizada
export function validateStep(name: SagaStepName, input: unknown): { ok: true; input: Record<string, unknown> } | { ok: false; error: string } {
  const result = (SAGA_STEPS[name].schema as ZodType<Record<string, unknown>>).safeParse(input);
  return result.success ? { ok: true, input: result.data } : { ok: false, error: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") };
}

export const sagaOrchestrator = new SagaOrchestrator();
