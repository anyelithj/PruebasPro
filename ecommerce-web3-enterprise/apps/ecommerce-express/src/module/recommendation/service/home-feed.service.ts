// home-feed.service.ts => RF-18.7 portada personalizada: productos destacados para CADA visitante según su historial
// (si inició sesión) y su contexto: franja horaria, ubicación (país de la IP / ciudad) y dispositivo.
//  1) Historial: co-compras y categorías de sus últimas compras (mismas estrategias del recomendador, sin LLM)
//  2) Contexto: lo más vendido en los últimos 60 días en su franja horaria y su zona
//  3) Respaldo: populares del catálogo (arranque en frío)
// El dispositivo define cuántas tarjetas se muestran (móvil = 4: menos datos y scroll).
// Patrones: Chain of Responsibility (historial -> contexto -> popular) + Strategy (franjas como datos).
// Paradigma: funcional (daypart = función pura) + asíncrono. Sin LLM: la portada debe ser instantánea.
import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import { productRepository } from "../../product/repository/product.repository";
import { recommendationRepository } from "../repository/recommendation.repository";
import { rankCandidates } from "../ml/recommendation.ml";
import type { ProductListItemDto } from "../../product/dto/product.dto";

export type Daypart = "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT";
export type Device = "mobile" | "tablet" | "desktop";
export interface HomeContext {
  hour: number; // Hora LOCAL del visitante (la envía el navegador)
  device: Device;
  country?: string | undefined; // ISO alpha-2 (cabecera del CDN)
  city?: string | undefined;
}

// DAYPARTS => franjas horarias [desde, hasta] (la noche cruza la medianoche)
const DAYPARTS: Record<Daypart, [number, number]> = { MORNING: [5, 11], AFTERNOON: [12, 17], EVENING: [18, 22], NIGHT: [23, 4] };

// daypart => franja de una hora (función PURA, testeable)
export const daypart = (hour: number): Daypart =>
  (Object.entries(DAYPARTS).find(([, [from, to]]) => (from <= to ? hour >= from && hour <= to : hour >= from || hour <= to))?.[0] ?? "NIGHT") as Daypart;

export const cardsFor = (device: Device) => (device === "mobile" ? 4 : device === "tablet" ? 6 : 8);

export async function homeFeed(userId: string | null, context: HomeContext): Promise<{ reason: "HISTORY" | "CONTEXT" | "POPULAR"; daypart: Daypart; products: ProductListItemDto[] }> {
  const limit = cardsFor(context.device);
  const part = daypart(context.hour);
  // 1) Historial del cliente autenticado
  if (userId) {
    const seeds = await recommendationRepository.recentPurchases(userId);
    if (seeds.length > 0) {
      const categories = await recommendationRepository.categoriesOf(seeds);
      const [coPurchase, category] = await Promise.all([recommendationRepository.coPurchase(seeds, 30), recommendationRepository.byCategories(categories, 30)]);
      const ranked = rankCandidates({ CO_PURCHASE: coPurchase, CATEGORY: category, POPULAR: [] }, new Set(seeds), limit);
      if (ranked.productIds.length >= Math.min(4, limit)) return { reason: "HISTORY", daypart: part, products: await cardsInOrder(ranked.productIds) };
    }
  }
  // 2) Contexto: franja horaria (hora de Colombia en la base) + zona del envío
  const [from, to] = DAYPARTS[part];
  const hourFilter = from <= to ? Prisma.sql`h BETWEEN ${from} AND ${to}` : Prisma.sql`(h >= ${from} OR h <= ${to})`;
  const zone = context.city
    ? Prisma.sql`AND lower(o."shippingAddress"->>'city') = lower(${context.city})`
    : context.country
      ? Prisma.sql`AND upper(o."shippingAddress"->>'country') IN (${context.country}, ${context.country === "CO" ? "COLOMBIA" : context.country})`
      : Prisma.empty;
  const rows = await prisma.$queryRaw<Array<{ productId: string }>>(Prisma.sql`
    SELECT oi."productId" FROM (
      SELECT o.id, EXTRACT(HOUR FROM o."placedAt" AT TIME ZONE 'America/Bogota')::int AS h FROM orders o
      WHERE o."placedAt" >= NOW() - INTERVAL '60 days' AND o.status <> 'CANCELLED' ${zone}
    ) t
    JOIN order_items oi ON oi."orderId" = t.id
    JOIN products p ON p.id = oi."productId" AND p.status = 'ACTIVE'
    WHERE ${hourFilter}
    GROUP BY oi."productId" ORDER BY SUM(oi.quantity) DESC LIMIT ${limit}`);
  if (rows.length >= Math.min(4, limit)) return { reason: "CONTEXT", daypart: part, products: await cardsInOrder(rows.map((row) => row.productId)) };
  // 3) Arranque en frío
  const popular = await recommendationRepository.popular(limit);
  return { reason: "POPULAR", daypart: part, products: await cardsInOrder(popular.map((candidate) => candidate.productId)) };
}

// cardsInOrder => tarjetas en el MISMO orden del ranking (findCardsByIds no garantiza orden)
async function cardsInOrder(ids: string[]): Promise<ProductListItemDto[]> {
  const cards = new Map((await productRepository.findCardsByIds(ids)).map((card) => [card.id, card]));
  return ids.flatMap((id) => cards.get(id) ?? []);
}
