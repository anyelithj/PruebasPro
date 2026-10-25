// inventory.service.ts (TypeScript + ioredis + Prisma) => inventario en tiempo real (sprint 9.1, reemplazo temporal de Rust).
// - Lecturas < 10 ms desde el Map en memoria (InventoryStore); un miss va UNA vez a PostgreSQL y repuebla el Map.
// - Escrituras SIEMPRE en PostgreSQL (fuente de verdad) a través del módulo inventory existente (DRY: misma guarda
//   atómica, mismo historial de movimientos); el Map se actualiza con el evento "inventory.adjusted" (Observer).
// - Reservas de carrito: PostgreSQL ("reservedStock", guarda atómica) + Redis con TTL; el job releaseExpired libera
//   las vencidas (carrito abandonado). ZREM decide quién libera: la liberación ocurre UNA sola vez aunque coincidan
//   el DELETE del cliente y el barrido (idempotencia sin locks).
// Patrones: Repository (store + repository), Observer (onChange), Strategy de origen (memory | database).
import { randomUUID } from "node:crypto";
import { redis } from "../../../config/redis.config";
import { appConfig } from "../../../config/app.config";
import { inventoryRepository, type InventoryRepository } from "../../inventory/repository/inventory.repository";
import { inventoryService, type InventoryService } from "../../inventory/service/inventory.service";
import { inventoryEvents } from "../../inventory/event/inventory.event";
import type { StockLevel } from "../../inventory/model/inventory.model";
import { isAdmin } from "../../../shared/decorator/auth.decorator";
import { logger } from "../../../shared/middleware/logger.middleware";
import { InventoryStore } from "../store/dashmap.store";
import { expiryMember, parseExpiryMember, RtInventoryKeys, type StockReservation } from "../model/inventory.model";
import { toStockResponse, type ReservationRequest, type StockRequest, type StockResponse } from "../dto/inventory.dto";
import { InventoryError } from "../error/inventory.error";

const RESERVATION_GRACE_SECONDS = 120; // La clave de la reserva sobrevive un poco a su vencimiento (lecturas del DELETE)
const SWEEP_BATCH = 200; // Reservas vencidas liberadas por barrido (acota el trabajo de cada minuto)

// Viewer => quien pide la operación (id + roles del JWT)
interface Viewer {
  readonly id: string;
  readonly roles: string[];
}

// ChangeListener => suscriptor de cambios de stock (el gateway Socket.io); "=>" en un tipo = firma de función
type ChangeListener = (entry: StockResponse) => void;

export class RealtimeInventoryService {
  private readonly listeners = new Set<ChangeListener>();
  private subscribed = false;

  // Inyección de dependencias por constructor (DIP) con valores por defecto: los tests pasan dobles
  constructor(
    private readonly store: InventoryStore = new InventoryStore(),
    private readonly levels: InventoryRepository = inventoryRepository,
    private readonly stock: InventoryService = inventoryService,
    private readonly threshold = appConfig.LOW_STOCK_THRESHOLD
  ) {}

  // onChange => Observer: registra un oyente y devuelve la función para darlo de baja
  public onChange(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // registerSubscribers => cualquier cambio de stock del módulo inventory (ajuste, movimiento, anulación) refresca el Map
  public registerSubscribers(): void {
    if (this.subscribed) return; // Idempotente: una sola suscripción por proceso
    this.subscribed = true;
    inventoryEvents.on("inventory.adjusted", (level) => this.sync(level));
  }

  // getStock => GET /api/v1/rt/inventory/:id — Map (< 10 ms) o PostgreSQL en el primer acceso
  public async getStock(variantId: string): Promise<StockResponse> {
    const hit = this.store.get(variantId);
    if (hit) return toStockResponse(hit, "memory", this.threshold);
    const level = await this.levels.findLevel(variantId);
    if (!level) throw InventoryError.notFound(variantId);
    return toStockResponse(this.store.put(level), "database", this.threshold);
  }

  // replaceStock => PUT /api/v1/rt/inventory/:id/stock — reemplazo total vía el módulo inventory (movimiento ADJUSTMENT)
  public async replaceStock(variantId: string, input: StockRequest, actorId: string): Promise<StockResponse> {
    const { level } = await this.stock.updateInventory(variantId, input, actorId); // Publica "inventory.adjusted" => sync()
    return toStockResponse(this.store.put(level), "database", this.threshold);
  }

  // reserve => POST /api/v1/rt/inventory/reservation — idempotente por carrito + variante
  public async reserve(input: ReservationRequest, userId: string): Promise<StockReservation> {
    const id = randomUUID();
    const indexKey = RtInventoryKeys.cartIndex(input.cart_id, input.product_id);
    // SET NX => "reclama" el par carrito+variante de forma atómica: solo la primera petición sigue
    const claimed = await redis.set(indexKey, id, "EX", input.ttl_seconds, "NX").catch(() => {
      throw InventoryError.unavailable();
    });
    if (claimed !== "OK") return this.existingReservation(indexKey);

    const reserved = await this.levels.reserve(input.product_id, input.quantity).catch(async (error: unknown) => {
      await redis.del(indexKey).catch(() => undefined);
      throw error;
    });
    if (!reserved) {
      await redis.del(indexKey).catch(() => undefined);
      const level = await this.levels.findLevel(input.product_id);
      throw level ? InventoryError.insufficientStock(level.available) : InventoryError.notFound(input.product_id);
    }

    const expiresAtMs = Date.now() + input.ttl_seconds * 1000;
    const reservation: StockReservation = { id, productId: input.product_id, cartId: input.cart_id, userId, quantity: input.quantity, expiresAt: new Date(expiresAtMs).toISOString() };
    // MULTI => la reserva y su vencimiento se guardan juntos; si Redis falla se devuelve el stock (compensación)
    const saved = await redis
      .multi()
      .set(RtInventoryKeys.reservation(id), JSON.stringify(reservation), "EX", input.ttl_seconds + RESERVATION_GRACE_SECONDS)
      .zadd(RtInventoryKeys.expiry, expiresAtMs, expiryMember(reservation))
      .exec()
      .catch(() => null);
    if (!saved || saved.some(([error]) => error)) {
      await this.levels.release(input.product_id, input.quantity);
      await redis.del(indexKey).catch(() => undefined);
      throw InventoryError.unavailable();
    }
    void this.refresh(input.product_id);
    return reservation;
  }

  // release => DELETE /api/v1/rt/inventory/reservation/:id — solo el dueño o un ADMIN
  public async release(id: string, viewer: Viewer): Promise<void> {
    const reservation = await this.findReservation(id);
    if (!reservation || (reservation.userId !== viewer.id && !isAdmin(viewer))) throw InventoryError.reservationNotFound(id);
    await this.releaseOne(reservation);
    await redis.del(RtInventoryKeys.reservation(id), RtInventoryKeys.cartIndex(reservation.cartId, reservation.productId)).catch(() => undefined);
  }

  // releaseExpired => job de cada minuto: libera reservas vencidas (carritos abandonados). Sin Redis no hace nada
  public async releaseExpired(now = Date.now()): Promise<number> {
    if (redis.status !== "ready") return 0; // Ahorro: no se intenta (ni se registra un error) con Redis caído
    const members = await redis.zrangebyscore(RtInventoryKeys.expiry, 0, now, "LIMIT", 0, SWEEP_BATCH);
    let released = 0;
    for (const member of members) {
      const parsed = parseExpiryMember(member);
      if (!parsed) {
        await redis.zrem(RtInventoryKeys.expiry, member); // Miembro corrupto: se descarta
        continue;
      }
      if (await this.releaseOne(parsed)) released += 1;
    }
    if (released > 0) logger.info("rt_inventory_reservations_expired", { released });
    return released;
  }

  // warm => pre-carga del Map con las variantes más críticas (menos disponibles primero); lo usa cache/warmup
  public async warm(limit: number): Promise<number> {
    const { items } = await this.levels.findLevels({ lowOnly: false, threshold: this.threshold }, { page: 1, limit, skip: 0 });
    items.forEach((level) => this.store.put(level));
    return items.length;
  }

  // releaseOne => ZREM == 1 garantiza que este llamador es el ÚNICO que devuelve las unidades a PostgreSQL
  private async releaseOne(reservation: Pick<StockReservation, "id" | "productId" | "quantity">): Promise<boolean> {
    const removed = await redis.zrem(RtInventoryKeys.expiry, expiryMember(reservation));
    if (removed !== 1) return false;
    await this.levels.release(reservation.productId, reservation.quantity);
    void this.refresh(reservation.productId);
    return true;
  }

  private async existingReservation(indexKey: string): Promise<StockReservation> {
    const existingId = await redis.get(indexKey);
    const existing = existingId ? await this.findReservation(existingId) : null;
    if (!existing) throw InventoryError.reservationInProgress();
    return existing;
  }

  private async findReservation(id: string): Promise<StockReservation | null> {
    const raw = await redis.get(RtInventoryKeys.reservation(id)).catch(() => {
      throw InventoryError.unavailable();
    });
    return raw ? (JSON.parse(raw) as StockReservation) : null;
  }

  // refresh => relee PostgreSQL tras reservar/liberar (cambia "reservedStock" sin evento) y difunde el nuevo valor
  private async refresh(variantId: string): Promise<void> {
    const level = await this.levels.findLevel(variantId).catch(() => null);
    if (level) this.sync(level);
  }

  // sync => actualiza el Map y avisa a los oyentes (Socket.io /rt/inventory)
  private sync(level: StockLevel): void {
    const response = toStockResponse(this.store.put(level), "database", this.threshold);
    this.listeners.forEach((listener) => listener(response));
  }
}

// Singleton del módulo: un solo Map por proceso
export const realtimeInventoryService = new RealtimeInventoryService();
