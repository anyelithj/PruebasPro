// cache.service.ts (TypeScript + ioredis) => caché de DOS niveles (sprint 9.3, reemplazo temporal del DashMap de Rust).
//   L1 = Map en memoria del proceso (DashMapStore: TTL + LRU con tope) => lecturas < 1 ms, sin red.
//   L2 = Redis (volatile-lru, 128 MB) => compartido entre réplicas y sobrevive reinicios del proceso.
// Patrones: Cache-Aside (getOrLoad), Write-Through (set escribe L1 y L2), Strategy (warmup por namespace) y
// prevención de "cache stampede" (una sola carga en vuelo por clave). Graceful Degradation: si Redis cae, L1 sigue.
import { redis } from "../../../config/redis.config";
import { prisma } from "../../../config/database.config";
import { invalidatePattern } from "../../../shared/interceptor/cache.interceptor";
import { DashMapStore, type StoreStats } from "../store/dashmap.store";
import { CacheError } from "../error/cache.error";
import type { GetCacheResponse, ReplaceCacheRequest, SetCacheRequest, WarmupNamespace, WarmupRequest } from "../dto/cache.dto";
import { realtimeInventoryService } from "../../realtime_inventory/service/inventory.service";

const L2_PREFIX = "rt:cache:"; // Prefijo propio: un admin no puede pisar claves de otros módulos (rbac:, cart:...)
const L1_MAX_ENTRIES = 5_000; // Techo de RAM de L1 (entradas de hasta 64 KB, la mayoría mucho menores)
const L1_DEFAULT_TTL_MS = 5 * 60_000;
const l2Key = (key: string) => `${L2_PREFIX}${key}`; // Arrow function pura: clave L2 a partir de la clave pública

// globToRegExp => "product:*" -> /^product:.*$/ (función pura). El DTO ya limitó los caracteres permitidos.
export function globToRegExp(glob: string): RegExp {
  // "$&" => en replace() inserta el texto encontrado: escapa "." y "-" para que sean literales en la regex
  const source = glob.replace(/[.-]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${source}$`);
}

// WarmupLoader => Strategy: cada namespace sabe qué datos críticos pre-cargar y devuelve cuántas claves calentó
type WarmupLoader = (service: CacheService, limit: number) => Promise<number>;

// "Readonly<Record<K, V>>" => mapa inmutable namespace -> estrategia (OCP: un namespace nuevo = una entrada nueva)
const WARMUP_STRATEGIES: Readonly<Record<WarmupNamespace, WarmupLoader>> = {
  // product => fichas mínimas de los productos activos más recientes (lo que más pide el catálogo)
  product: async (service, limit) => {
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE", archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: { id: true, slug: true, name: true, minPriceCents: true, maxPriceCents: true, currency: true, ratingAvg: true },
    });
    await Promise.all(products.map((product) => service.set({ key: `product:${product.slug}`, value: product, ttl_seconds: 600 })));
    return products.length;
  },
  // pricing => precio vigente por variante (consultas de precio en carrito y comparadores)
  pricing: async (service, limit) => {
    const variants = await prisma.productVariant.findMany({
      where: { isActive: true, product: { status: "ACTIVE", archivedAt: null } },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: { id: true, priceCents: true, compareAtPriceCents: true, product: { select: { currency: true } } },
    });
    await Promise.all(
      variants.map((variant) =>
        service.set({
          key: `pricing:${variant.id}`,
          value: { priceCents: variant.priceCents, compareAtPriceCents: variant.compareAtPriceCents, currency: variant.product.currency },
          ttl_seconds: 300,
        })
      )
    );
    return variants.length;
  },
  // inventory => calienta el Map del inventario en tiempo real (sprint 9.1), no esta caché: una sola copia en RAM
  inventory: (_service, limit) => realtimeInventoryService.warm(limit),
  // ponytail: las sesiones ya viven en Redis (carrito "cart:active:*", nonce, rate limit) y se leen bajo demanda;
  // no hay datos de sesión que pre-cargar. Se acepta el namespace de la matriz y responde 0 claves.
  session: () => Promise.resolve(0),
};

export class CacheService {
  // inflight => cargas en curso por clave (anti-stampede): 100 peticiones simultáneas = 1 sola consulta a la DB
  private readonly inflight = new Map<string, Promise<unknown>>();

  // Inyección por constructor (DIP) con valor por defecto: los tests pasan un store pequeño
  constructor(private readonly l1 = new DashMapStore<unknown>(L1_MAX_ENTRIES, L1_DEFAULT_TTL_MS)) {}

  // set => Write-Through: L1 y L2 a la vez. Si Redis falla, la escritura en L1 basta (degradación elegante)
  public async set(input: SetCacheRequest): Promise<{ key: string; ttlSeconds: number; l2: boolean }> {
    this.l1.set(input.key, input.value, input.ttl_seconds * 1000);
    const l2 = await redis
      .set(l2Key(input.key), JSON.stringify(input.value), "EX", input.ttl_seconds) // "EX" => TTL en segundos
      .then(() => true)
      .catch(() => false);
    return { key: input.key, ttlSeconds: input.ttl_seconds, l2 };
  }

  // get => L1 (< 1 ms) -> L2 (Redis) -> 404. Un acierto en L2 repuebla L1 con el TTL restante real (PTTL)
  public async get(key: string): Promise<GetCacheResponse> {
    const local = this.l1.get(key);
    if (local !== undefined) return { key, value: local, source: "L1", ttlSeconds: Math.ceil(this.l1.ttlMs(key) / 1000) };
    const remote = await this.readL2(key);
    if (!remote) throw CacheError.keyNotFound(key);
    this.l1.set(key, remote.value, remote.ttlMs);
    return { key, value: remote.value, source: "L2", ttlSeconds: Math.ceil(remote.ttlMs / 1000) };
  }

  // replace => PUT: la clave DEBE existir; sin ttl_seconds conserva el TTL restante
  public async replace(key: string, input: ReplaceCacheRequest): Promise<{ key: string; ttlSeconds: number; l2: boolean }> {
    const current = await this.get(key); // 404 si no existe
    const ttlSeconds = input.ttl_seconds ?? current.ttlSeconds; // "??" => solo usa el restante si no llegó ttl_seconds
    if (ttlSeconds <= 0) throw CacheError.ttlExpired(key);
    return this.set({ key, value: input.value, ttl_seconds: ttlSeconds });
  }

  // delete => invalidación por clave (idempotente: borrar una clave inexistente no es error)
  public async delete(key: string): Promise<void> {
    this.l1.delete(key);
    await redis.del(l2Key(key)).catch(() => undefined);
  }

  // deletePattern => invalidación por glob en ambos niveles (L2 con SCAN, nunca KEYS: no bloquea Redis)
  public async deletePattern(pattern: string): Promise<{ pattern: string; l1Removed: number }> {
    // Un patrón sin letras ni dígitos (ej. "?:?") borraría claves al azar: solo "*" (todo) se permite así
    if (!/[a-z0-9]/.test(pattern) && pattern !== "*") throw CacheError.patternInvalid(pattern);
    const l1Removed = this.l1.deleteMatching(globToRegExp(pattern));
    await invalidatePattern(l2Key(pattern));
    return { pattern, l1Removed };
  }

  // getOrLoad => Cache-Aside genérico para otros módulos: L1 -> L2 -> loader (una sola carga en vuelo por clave)
  public async getOrLoad<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const local = this.l1.get(key);
    if (local !== undefined) return local as T;
    const pending = this.inflight.get(key);
    if (pending) return pending as Promise<T>; // Otra petición ya está cargando la misma clave: se comparte
    // IIFE asíncrona => crea la promesa de carga una sola vez y la registra en "inflight"
    const load = (async () => {
      const remote = await this.readL2(key);
      if (remote) {
        this.l1.set(key, remote.value, remote.ttlMs);
        return remote.value as T;
      }
      const value = await loader();
      await this.set({ key, value: value as SetCacheRequest["value"], ttl_seconds: ttlSeconds });
      return value;
    })().finally(() => this.inflight.delete(key)); // "finally" => se libera aunque el loader falle
    this.inflight.set(key, load);
    return load;
  }

  // warmup => Strategy por namespace (product | session | inventory | pricing)
  public async warmup(input: WarmupRequest): Promise<{ namespace: WarmupNamespace; warmed: number; stats: StoreStats }> {
    const warmed = await WARMUP_STRATEGIES[input.namespace](this, input.limit);
    return { namespace: input.namespace, warmed, stats: this.l1.stats() };
  }

  // purgeExpired => job periódico del bootstrap: libera RAM de entradas vencidas que nadie volvió a leer
  public purgeExpired(): number {
    return this.l1.purgeExpired();
  }

  // readL2 => valor + TTL restante en una ida y vuelta (MULTI: GET + PTTL); null si no existe o Redis no responde
  private async readL2(key: string): Promise<{ value: unknown; ttlMs: number } | null> {
    const results = await redis.multi().get(l2Key(key)).pttl(l2Key(key)).exec().catch(() => null);
    const raw = results?.[0]?.[1]; // "?." => encadenamiento opcional: undefined si Redis no respondió
    const ttlMs = Number(results?.[1]?.[1] ?? 0);
    if (typeof raw !== "string" || ttlMs <= 0) return null; // PTTL -2 = no existe, -1 = sin TTL (no es nuestra)
    return { value: JSON.parse(raw) as unknown, ttlMs };
  }
}

// Singleton del módulo: una sola L1 por proceso
export const cacheService = new CacheService();
