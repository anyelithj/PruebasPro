// circuit_breaker.guard.ts (TypeScript, sin librerías) => Circuit Breaker: máquina de estados CLOSED/OPEN/HALF_OPEN.
//   CLOSED    => las llamadas pasan; N fallos SEGUIDOS abren el circuito.
//   OPEN      => se rechaza al instante (fail fast) sin llamar al proveedor hasta que pase resetTimeoutMs.
//   HALF_OPEN => se deja pasar UNA llamada de prueba: si funciona se cierra; si falla se vuelve a abrir.
// Además impone un timeout por llamada (un proveedor lento cuenta como fallo). Ahorro: con el proveedor caído no se
// gastan sockets, CPU ni tiempo de espera del cliente. Patrón State + Guard (protege la llamada saliente).
// Estado en memoria por proceso: cada réplica observa sus propios fallos (comportamiento estándar del patrón).
import { GatewayError } from "../error/gateway.error";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN"; // Tipo unión de literales: solo estos 3 valores

export interface CircuitBreakerOptions {
  readonly failureThreshold: number; // Fallos seguidos que abren el circuito
  readonly resetTimeoutMs: number; // Tiempo en OPEN antes de probar (HALF_OPEN)
  readonly timeoutMs: number; // Tiempo máximo por llamada
}

export interface CircuitSnapshot {
  readonly name: string;
  readonly state: CircuitState;
  readonly failures: number;
  readonly retryInMs: number;
}

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failures = 0;
  private openedAt = 0;
  private probing = false; // HALF_OPEN: ¿ya hay una llamada de prueba en curso?

  constructor(
    public readonly name: string,
    private readonly options: CircuitBreakerOptions,
    private readonly now: () => number = Date.now // Reloj inyectable (tests deterministas)
  ) {}

  public snapshot(): CircuitSnapshot {
    const retryInMs = this.state === "OPEN" ? Math.max(0, this.openedAt + this.options.resetTimeoutMs - this.now()) : 0;
    return { name: this.name, state: this.state, failures: this.failures, retryInMs };
  }

  // execute => envuelve la llamada. "isFailure" decide qué errores cuentan (un 4xx del negocio NO abre el circuito)
  public async execute<T>(operation: () => Promise<T>, isFailure: (error: unknown) => boolean = () => true): Promise<T> {
    if (this.state === "OPEN") {
      if (this.now() - this.openedAt < this.options.resetTimeoutMs) throw GatewayError.circuitOpen(this.name, this.snapshot().retryInMs);
      this.state = "HALF_OPEN"; // Pasó el tiempo de enfriamiento: se permite una prueba
    }
    if (this.state === "HALF_OPEN") {
      if (this.probing) throw GatewayError.circuitOpen(this.name, this.options.resetTimeoutMs);
      this.probing = true;
    }
    try {
      const result = await this.withTimeout(operation());
      this.state = "CLOSED";
      this.failures = 0;
      return result;
    } catch (error) {
      if (isFailure(error)) this.recordFailure();
      else if (this.state === "HALF_OPEN") this.state = "CLOSED"; // El proveedor respondió (aunque fuera un 4xx): está vivo
      throw error;
    } finally {
      this.probing = false; // "finally" => se ejecuta con éxito o con error
    }
  }

  private recordFailure(): void {
    this.failures += 1;
    if (this.state === "HALF_OPEN" || this.failures >= this.options.failureThreshold) {
      this.state = "OPEN";
      this.openedAt = this.now();
    }
  }

  // withTimeout => "Promise.race": gana la primera promesa en resolverse (la llamada o el temporizador)
  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(GatewayError.timeout(this.name, this.options.timeoutMs)), this.options.timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)); // Sin timers colgados
  }
}
