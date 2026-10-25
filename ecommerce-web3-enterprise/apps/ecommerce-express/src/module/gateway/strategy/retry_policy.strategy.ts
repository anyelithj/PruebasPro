// retry_policy.strategy.ts (TypeScript) => política de reintentos con backoff exponencial + "full jitter".
// Patrón Strategy + Retry: el llamador decide QUÉ es reintentable (shouldRetry) y la política decide CUÁNTO esperar.
// Idempotency-Key: todos los reintentos de una misma operación reutilizan la MISMA clave (la del cliente o la que el
// módulo payment deriva de la sesión de checkout), así el proveedor nunca ejecuta dos veces el mismo cobro.
// "Full jitter" (espera aleatoria entre 0 y el tope) evita que muchos clientes reintenten a la vez (thundering herd).
// La reutilizan gateway (Stripe) y blockchain (RPC) — DRY.
import { setTimeout as sleepMs } from "node:timers/promises"; // Versión con promesa de setTimeout (Node nativo)

// RetryPolicy => parámetros inmutables de la estrategia
export interface RetryPolicy {
  readonly maxAttempts: number; // Intentos totales (1 = sin reintentos)
  readonly baseDelayMs: number; // Espera base del primer reintento
  readonly maxDelayMs: number; // Tope de la espera (el exponencial crece rápido)
}

// "Object.freeze" => la política por defecto no se puede modificar en runtime
export const DEFAULT_RETRY_POLICY: RetryPolicy = Object.freeze({ maxAttempts: 3, baseDelayMs: 200, maxDelayMs: 2_000 });

// backoffDelay => función pura: espera antes del intento "attempt + 1" (attempt empieza en 1)
export function backoffDelay(attempt: number, policy: RetryPolicy, random: () => number = Math.random): number {
  const ceiling = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (attempt - 1)); // "**" => potencia: 200, 400, 800...
  return Math.round(random() * ceiling);
}

// withRetry => ejecuta "operation" hasta maxAttempts veces mientras el error sea reintentable.
// "<T>" genérico => devuelve el tipo de la operación junto con los intentos realizados (para auditoría)
export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  sleep: (ms: number) => Promise<unknown> = sleepMs // Inyectable: los tests no esperan de verdad
): Promise<{ value: T; attempts: number }> {
  // "for (;;)" con return/throw => bucle explícito sin recursión (sin crecer la pila)
  for (let attempt = 1; ; attempt += 1) {
    try {
      return { value: await operation(attempt), attempts: attempt };
    } catch (error) {
      if (attempt >= policy.maxAttempts || !shouldRetry(error)) throw error;
      await sleep(backoffDelay(attempt, policy));
    }
  }
}
