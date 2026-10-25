// collection.model.ts => regla de vigencia de una colección como función pura (fácil de testear sin DB).
import type { CollectionDto } from "../dto/collection.dto";

// isCollectionLive => visible en la tienda si está activa y "now" cae dentro de su ventana de vigencia
// "now" inyectable (parámetro con valor por defecto): los tests fijan la fecha sin mockear Date
export function isCollectionLive(collection: Pick<CollectionDto, "isActive" | "startsAt" | "endsAt">, now: Date = new Date()): boolean {
  if (!collection.isActive) return false;
  if (collection.startsAt && collection.startsAt > now) return false; // Aún no empieza
  if (collection.endsAt && collection.endsAt < now) return false; // Ya terminó
  return true;
}

// LookDiscount => regla de un look (colección con descuento) para el cálculo puro
export interface LookRule {
  id: string;
  name: string;
  percent: number;
  productIds: readonly string[];
}

// lookDiscount => RF-04.2 / RF-05.5 descuento por "look completo" — función PURA (sin DB: testeable).
// Un look aplica por cada JUEGO completo: si el carrito trae TODOS sus productos (looks de 2+ productos), el número de
// juegos es la menor cantidad entre ellos; el descuento es el % sobre el precio de esos juegos. Se procesan primero
// los looks de mayor %, y las unidades usadas en un look no se reutilizan en otro (sin doble descuento).
export function lookDiscount(
  items: ReadonlyArray<{ productId: string; unitPriceCents: number; quantity: number }>,
  looks: readonly LookRule[]
): { discountCents: number; applied: Array<{ collectionId: string; name: string; sets: number; discountCents: number }> } {
  // Unidades disponibles y precio unitario más bajo por producto (si hay varias variantes del mismo producto)
  const remaining = new Map<string, number>();
  const price = new Map<string, number>();
  for (const item of items) {
    remaining.set(item.productId, (remaining.get(item.productId) ?? 0) + item.quantity);
    price.set(item.productId, Math.min(price.get(item.productId) ?? Number.POSITIVE_INFINITY, item.unitPriceCents));
  }
  const applied: Array<{ collectionId: string; name: string; sets: number; discountCents: number }> = [];
  // "[...looks].sort" => copia ordenada (no muta el arreglo recibido: inmutabilidad)
  for (const look of [...looks].sort((a, b) => b.percent - a.percent)) {
    if (look.productIds.length < 2) continue; // Un look es un conjunto: con un solo producto sería un descuento normal
    const sets = Math.min(...look.productIds.map((productId) => remaining.get(productId) ?? 0));
    if (sets <= 0) continue;
    const setPrice = look.productIds.reduce((total, productId) => total + (price.get(productId) ?? 0), 0);
    const discountCents = Math.round((setPrice * sets * look.percent) / 100);
    look.productIds.forEach((productId) => remaining.set(productId, (remaining.get(productId) ?? 0) - sets));
    applied.push({ collectionId: look.id, name: look.name, sets, discountCents });
  }
  return { discountCents: applied.reduce((total, look) => total + look.discountCents, 0), applied };
}
