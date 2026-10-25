// dashmap.store.ts (Map nativa) => stock caliente en memoria: Map<variantId, InventoryEntry> (equivale al DashMap de Rust).
// Sin locks: el event loop de Node.js ejecuta un callback a la vez, así que get/set nunca se pisan dentro del proceso.
// Herencia (POO) + DRY: reutiliza DashMapStore del módulo cache (TTL + LRU + tope) y solo agrega "put".
// TTL corto (15 s): el checkout también aparta stock en PostgreSQL sin pasar por aquí; el TTL acota cuánto puede
// atrasarse la copia en memoria. Con más de una réplica el estado caliente pasaría a Redis (ver 01_EXPRESS_TS.md).
import { DashMapStore } from "../../cache/store/dashmap.store";
import { toEntry, type InventoryEntry } from "../model/inventory.model";
import type { StockLevel } from "../../inventory/model/inventory.model";

const MAX_VARIANTS = 20_000; // ~200 bytes por entrada => techo aproximado de 4 MB de RAM
const TTL_MS = 15_000;

// "extends" => InventoryStore ES un DashMapStore<InventoryEntry> con una operación de dominio extra
export class InventoryStore extends DashMapStore<InventoryEntry> {
  constructor(maxEntries = MAX_VARIANTS, ttlMs = TTL_MS) {
    super(maxEntries, ttlMs); // "super(...)" => invoca el constructor de la clase base
  }

  // put => guarda la foto sincronizada desde PostgreSQL y la devuelve (para responder o difundir)
  public put(level: StockLevel): InventoryEntry {
    const entry = toEntry(level);
    this.set(entry.variantId, entry);
    return entry;
  }
}
