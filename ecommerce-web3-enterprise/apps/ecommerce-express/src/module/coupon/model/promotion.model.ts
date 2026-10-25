// promotion.model.ts => motor de PROMOCIONES automáticas (RF-13.4 / 13.7 / 13.8 / 13.9 / 13.10) como funciones puras.
// Cada tipo es una estrategia (Strategy) que calcula el descuento sobre las unidades elegibles del carrito; el motor las
// evalúa por PRIORIDAD (mayor primero) y respeta la COMBINABILIDAD: una promoción no combinable no descuenta unidades
// que ya descontó otra. Paradigma funcional: sin estado ni base de datos (testeable con datos en memoria).
import type { PromotionType } from "@prisma/client";

// PromotionLine => una línea del carrito/checkout con los datos del catálogo que deciden el alcance
export interface PromotionLine {
  variantId: string;
  productId: string;
  categoryId: string | null;
  brandId: string | null;
  collectionIds: string[];
  unitPriceCents: number;
  quantity: number;
}

// PromotionRule => la regla tal como se guarda (sin campos de auditoría)
export interface PromotionRule {
  id: string;
  name: string;
  type: PromotionType;
  buyQuantity: number | null;
  payQuantity: number | null;
  percent: number | null;
  tiers: Array<{ minQty: number; percent: number }> | null;
  productIds: string[];
  categoryIds: string[];
  brandIds: string[];
  collectionIds: string[];
  priority: number;
  stackable: boolean;
}

export interface AppliedPromotion {
  promotionId: string;
  name: string;
  discountCents: number;
}

// inScope => la línea pertenece al alcance de la regla (alcance vacío = todo el catálogo)
export function inScope(rule: Pick<PromotionRule, "productIds" | "categoryIds" | "brandIds" | "collectionIds">, line: PromotionLine): boolean {
  const scoped = rule.productIds.length + rule.categoryIds.length + rule.brandIds.length + rule.collectionIds.length > 0;
  if (!scoped) return true;
  return (
    rule.productIds.includes(line.productId) ||
    (line.categoryId !== null && rule.categoryIds.includes(line.categoryId)) ||
    (line.brandId !== null && rule.brandIds.includes(line.brandId)) ||
    line.collectionIds.some((id) => rule.collectionIds.includes(id))
  );
}

// Unit => una unidad física (las promociones NxM regalan las unidades más baratas)
interface Unit {
  key: string; // variantId#n
  priceCents: number;
}

// STRATEGIES => descuento por tipo sobre las unidades elegibles (Record exhaustivo: el compilador exige cada tipo)
const STRATEGIES: Record<PromotionType, (rule: PromotionRule, units: Unit[]) => { discountCents: number; used: Unit[] }> = {
  // 2x1, 3x2, 4x3: por cada grupo de X unidades se pagan Y; salen gratis las (X - Y) más baratas de cada grupo
  BUY_X_PAY_Y: (rule, units) => {
    const buy = rule.buyQuantity ?? 0;
    const pay = rule.payQuantity ?? 0;
    if (buy < 2 || pay < 1 || pay >= buy) return { discountCents: 0, used: [] };
    const sorted = [...units].sort((a, b) => b.priceCents - a.priceCents); // Caras primero: los grupos agrupan de mayor a menor
    const groups = Math.floor(sorted.length / buy);
    const used = sorted.slice(0, groups * buy);
    let discount = 0;
    for (let g = 0; g < groups; g += 1) discount += sorted.slice(g * buy, (g + 1) * buy).slice(pay).reduce((sum, unit) => sum + unit.priceCents, 0);
    return { discountCents: discount, used };
  },
  // Porcentaje sobre todas las unidades elegibles (descuento masivo temporal y oferta flash)
  PERCENT_OFF: (rule, units) => percentOf(units, rule.percent ?? 0),
  FLASH: (rule, units) => percentOf(units, rule.percent ?? 0),
  // Escalonado: el porcentaje del mayor tramo alcanzado según la cantidad total de unidades elegibles
  TIERED: (rule, units) => {
    const tier = [...(rule.tiers ?? [])].sort((a, b) => b.minQty - a.minQty).find((entry) => units.length >= entry.minQty);
    return tier ? percentOf(units, tier.percent) : { discountCents: 0, used: [] };
  },
};

function percentOf(units: Unit[], percent: number): { discountCents: number; used: Unit[] } {
  const safe = Math.min(90, Math.max(0, percent)); // Tope de seguridad: nunca más del 90 %
  const total = units.reduce((sum, unit) => sum + unit.priceCents, 0);
  return { discountCents: Math.floor((total * safe) / 100), used: safe > 0 ? units : [] };
}

// applyPromotions => descuento total + detalle por promoción (historial RF-13.10). Reglas de combinación:
// - prioridad DESC; - una promoción NO combinable ignora unidades ya descontadas; - una combinable puede sumarse
//   sobre unidades descontadas solo por otras combinables; - el total nunca supera el subtotal
export function applyPromotions(lines: PromotionLine[], rules: PromotionRule[]): { discountCents: number; applied: AppliedPromotion[] } {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const lockedByExclusive = new Set<string>(); // Unidades descontadas por una promoción no combinable
  const touched = new Set<string>(); // Unidades descontadas por cualquier promoción
  const applied: AppliedPromotion[] = [];
  for (const rule of [...rules].sort((a, b) => b.priority - a.priority)) {
    const units = lines
      .filter((line) => inScope(rule, line))
      .flatMap((line) => Array.from({ length: line.quantity }, (_, n) => ({ key: `${line.variantId}#${n}`, priceCents: line.unitPriceCents })))
      .filter((unit) => !lockedByExclusive.has(unit.key) && (rule.stackable || !touched.has(unit.key)));
    const { discountCents, used } = STRATEGIES[rule.type](rule, units);
    if (discountCents <= 0) continue;
    for (const unit of used) {
      touched.add(unit.key);
      if (!rule.stackable) lockedByExclusive.add(unit.key);
    }
    applied.push({ promotionId: rule.id, name: rule.name, discountCents });
  }
  const total = Math.min(subtotal, applied.reduce((sum, entry) => sum + entry.discountCents, 0));
  return { discountCents: total, applied };
}

// seasonalDates => RF-13.9 fechas de Black Friday (cuarto viernes de noviembre) y Cyber Monday (lunes siguiente), en
// hora de Colombia (UTC-5): de 00:00 a 23:59:59 del día
export function seasonalDates(year: number): { blackFriday: { startsAt: Date; endsAt: Date }; cyberMonday: { startsAt: Date; endsAt: Date } } {
  const firstNov = new Date(Date.UTC(year, 10, 1));
  const firstFriday = 1 + ((5 - firstNov.getUTCDay() + 7) % 7);
  const friday = firstFriday + 21; // Cuarto viernes
  const day = (date: number) => ({ startsAt: new Date(Date.UTC(year, 10, date, 5, 0, 0)), endsAt: new Date(Date.UTC(year, 10, date + 1, 4, 59, 59)) });
  return { blackFriday: day(friday), cyberMonday: day(friday + 3) };
}
