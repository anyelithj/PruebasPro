import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
// [BackgroundTasks · 2026-10-27]: «guardar primero, enriquecer después» — ejecuta en segundo plano (mismo proceso) el trabajo lento que NO debe retener la respuesta HTTP
// (IPA + traducción con FastAPI/Ollama en CPU, nivel CEFR estimado…) | Antes: crear una lectura o un diálogo esperaba 1–6 min a la IA antes de responder
// [Patrón]: Fire-and-Forget + Bounded Work Queue (cupo de concurrencia) + Coalescing por clave (varias peticiones del mismo recurso → una ejecución) | [Principio]: SRP + Fail-soft (un fallo se registra, nunca rompe la petición) + DIP (los casos de uso dependen de esta clase, no de setTimeout sueltos)
// [Tecnología]: Promises nativas (ES2015) + `Map`/`Set` (ES2015) + ciclo de vida de NestJS (OnApplicationShutdown)
// [Por qué no Bull]: la tarea necesita el JWT del usuario para llamar a FastAPI → guardarlo en Redis sería exponer credenciales; la tarea dura segundos/minutos y,
// si el proceso se reinicia, el relleno perezoso («Completar IPA y traducción», GET del diálogo) recupera lo que faltó | ponytail: en varios workers cada uno tiene su cola (aceptable: la clave coalesce por proceso)

// `export const` (TS): token de DI para el cupo (tests y configuración) | `Symbol` (ES2015): clave única que no choca con otros proveedores
export const BACKGROUND_CONCURRENCY = Symbol('BACKGROUND_CONCURRENCY');
const DEFAULT_CONCURRENCY = 2; // Ollama en CPU atiende una inferencia larga a la vez → 2 deja avanzar la IPA (espeak) de otra tarea

// `type` (TS): tarea asíncrona sin argumentos; su resultado se ignora (Fire-and-Forget)
export type BackgroundTask = () => Promise<unknown>;

// `@Injectable()` (NestJS): singleton del contenedor DI → una sola cola por proceso (la registra BackgroundTasksModule, @Global)
@Injectable()
export class BackgroundTasks implements OnApplicationShutdown {
  private readonly logger = new Logger(BackgroundTasks.name);
  private readonly limit: number;
  private readonly queue: string[] = []; // Claves en espera (orden FIFO)
  private readonly waiting = new Map<string, BackgroundTask>(); // Clave → ÚLTIMA tarea pedida (coalescing: gana el token/datos más recientes)
  private readonly running = new Set<string>(); // Claves en ejecución
  private readonly rerun = new Map<string, BackgroundTask>(); // Pedida mientras corría → se ejecuta UNA vez más al terminar (nada se pierde)
  private idleWaiters: Array<() => void> = []; // Resolutores de `idle()`

  // `@Optional() @Inject(TOKEN)` (NestJS): sin proveedor del token → cupo por defecto | `Math.max(1, …)`: nunca 0 (la cola no avanzaría)
  constructor(@Optional() @Inject(BACKGROUND_CONCURRENCY) limit?: number) {
    this.limit = Math.max(1, limit ?? DEFAULT_CONCURRENCY);
  }

  // [schedule]: encola `task` bajo `key` y vuelve AL INSTANTE (la petición HTTP responde sin esperar)
  // - misma clave ya en espera → se sustituye por la nueva (una sola ejecución con los datos más recientes)
  // - misma clave corriendo → se reprograma para cuando termine (p. ej. el docente añadió más ejemplos mientras se traducían los primeros)
  schedule(key: string, task: BackgroundTask): void {
    if (this.running.has(key)) {
      this.rerun.set(key, task);
      return;
    }
    if (!this.waiting.has(key)) this.queue.push(key);
    this.waiting.set(key, task);
    this.pump();
  }

  // [isActive]: ¿hay trabajo pendiente o en curso para esta clave? → la API expone `enriching: true` y la UI muestra «Generando IPA/traducción…»
  isActive(key: string): boolean {
    return this.waiting.has(key) || this.running.has(key) || this.rerun.has(key);
  }

  // [idle]: promesa que se cumple cuando la cola queda vacía (tests y apagado ordenado)
  idle(): Promise<void> {
    if (this.isIdle()) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve)); // `new Promise` (ES2015): se resuelve desde `settle`
  }

  // [onApplicationShutdown] (NestJS): al parar el servidor espera a lo que esté corriendo (máx. 10 s) → no se corta una escritura a medias
  async onApplicationShutdown(): Promise<void> {
    this.queue.length = 0; // Lo que no empezó se descarta: el relleno perezoso lo recupera después
    this.waiting.clear();
    this.rerun.clear();
    await Promise.race([this.idle(), new Promise((r) => setTimeout(r, 10_000))]); // `Promise.race` (ES2015): lo que ocurra primero
  }

  private isIdle(): boolean {
    return !this.running.size && !this.queue.length;
  }

  // [pump]: arranca tareas mientras haya cupo | [Patrón]: Bounded Work Queue
  private pump(): void {
    while (this.running.size < this.limit && this.queue.length) {
      const key = this.queue.shift()!; // `shift` (JS): primera clave en espera (FIFO) | `!` (TS): no es undefined por la condición del while
      const task = this.waiting.get(key)!;
      this.waiting.delete(key);
      this.running.add(key);
      // `Promise.resolve().then(task)`: la tarea empieza en una microtarea → `schedule` nunca ejecuta código lento de forma síncrona
      void Promise.resolve()
        .then(task)
        .catch((err: unknown) =>
          this.logger.warn(`Tarea en segundo plano «${key}» falló: ${err instanceof Error ? err.message : String(err)}`),
        )
        .finally(() => this.settle(key)); // `finally` (ES2018): se libera el cupo pase lo que pase
    }
  }

  private settle(key: string): void {
    this.running.delete(key);
    const again = this.rerun.get(key);
    if (again) {
      this.rerun.delete(key);
      this.schedule(key, again);
    }
    this.pump();
    if (this.isIdle()) {
      const waiters = this.idleWaiters;
      this.idleWaiters = [];
      waiters.forEach((resolve) => resolve());
    }
  }
}

// [mapLimit · 2026-10-27]: `Promise.all` con un máximo de `limit` promesas a la vez y el MISMO orden de resultados | [Patrón]: Bounded Parallelism (estilo p-limit, sin dependencia)
// Uso: llamadas independientes a FastAPI (IPA de varios términos) → ~`limit`× más rápido que en serie sin saturar el servicio | [Paradigma]: Funcional + async/await
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length); // Resultados por índice → orden estable aunque terminen desordenados
  let next = 0; // Índice compartido por los «carriles» (JS es monohilo: no hay carreras entre `await`)
  const lane = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  // `Array.from({ length })` (ES2015): `limit` carriles, nunca más que elementos
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, lane));
  return out;
}
