// dashmap.store.ts (TypeScript, Map nativa) => caché L1 en memoria con TTL y desalojo LRU, con tope de entradas.
// Equivale al DashMap de Rust: en Node.js no hacen falta locks porque el event loop ejecuta un callback a la vez
// (concurrencia monohilo, sin condiciones de carrera dentro del proceso).
// Patrones: Repository (get/set/delete ocultan la estructura) + LRU (Least Recently Used) usando el ORDEN DE
// INSERCIÓN de Map: leer una clave la re-inserta al final; al pasar el tope se borra la primera (la menos usada).
// Ahorro de RAM: el tope fija la memoria máxima y las entradas vencidas se borran al leerlas o con purgeExpired().
// Genérico "<V>": la reutilizan cache (valores JSON) y realtime_inventory (InventoryEntry) — DRY.

// Slot => valor + instante de vencimiento (epoch ms). "readonly" => inmutable una vez guardado (paradigma funcional)
interface Slot<V> {
  readonly value: V;
  readonly expiresAt: number;
}

// StoreStats => métricas de hits/misses para observabilidad (tasa de acierto de la caché)
export interface StoreStats {
  readonly size: number;
  readonly maxEntries: number;
  readonly hits: number;
  readonly misses: number;
  readonly hitRate: number;
}

export class DashMapStore<V> {
  // "private readonly" => la Map no se expone ni se reemplaza (encapsulamiento POO)
  private readonly slots = new Map<string, Slot<V>>();
  private hits = 0;
  private misses = 0;

  constructor(
    public readonly maxEntries: number, // Tope de entradas => techo de memoria
    public readonly defaultTtlMs: number // TTL por defecto si set() no recibe uno
  ) {}

  // get => O(1); una entrada vencida cuenta como miss y se borra en el acto (limpieza perezosa, sin timers)
  public get(key: string, now = Date.now()): V | undefined {
    const slot = this.slots.get(key);
    if (!slot || slot.expiresAt <= now) {
      if (slot) this.slots.delete(key);
      this.misses += 1;
      return undefined;
    }
    // Re-inserción => la clave pasa al final del orden de la Map (la más recién usada: LRU)
    this.slots.delete(key);
    this.slots.set(key, slot);
    this.hits += 1;
    return slot.value;
  }

  // set => guarda con TTL; si se supera el tope desaloja la menos usada (la primera del orden de inserción)
  public set(key: string, value: V, ttlMs = this.defaultTtlMs, now = Date.now()): void {
    this.slots.delete(key); // Si ya existía, se mueve al final
    this.slots.set(key, { value, expiresAt: now + ttlMs });
    if (this.slots.size > this.maxEntries) {
      // "keys().next().value" => primera clave del iterador (la más antigua) sin copiar la Map
      const oldest = this.slots.keys().next().value;
      if (oldest !== undefined) this.slots.delete(oldest);
    }
  }

  // ttlMs => milisegundos de vida restantes (0 si no existe o ya venció)
  public ttlMs(key: string, now = Date.now()): number {
    const slot = this.slots.get(key);
    return slot ? Math.max(0, slot.expiresAt - now) : 0;
  }

  public delete(key: string): boolean {
    return this.slots.delete(key);
  }

  // deleteMatching => invalidación por patrón (expresión regular construida desde un glob en el service)
  public deleteMatching(pattern: RegExp): number {
    let removed = 0;
    // Borrar mientras se itera una Map es seguro en JavaScript (el iterador tolera eliminaciones)
    for (const key of this.slots.keys()) if (pattern.test(key) && this.slots.delete(key)) removed += 1;
    return removed;
  }

  // purgeExpired => barrido explícito de vencidas (libera RAM de claves que nadie volvió a leer)
  public purgeExpired(now = Date.now()): number {
    let removed = 0;
    for (const [key, slot] of this.slots) if (slot.expiresAt <= now && this.slots.delete(key)) removed += 1;
    return removed;
  }

  public stats(): StoreStats {
    const total = this.hits + this.misses;
    return { size: this.slots.size, maxEntries: this.maxEntries, hits: this.hits, misses: this.misses, hitRate: total ? Number((this.hits / total).toFixed(3)) : 0 };
  }
}
