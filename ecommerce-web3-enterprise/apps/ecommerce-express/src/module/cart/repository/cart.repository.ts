// cart.repository.ts => acceso a datos del carrito (PostgreSQL = fuente de verdad).
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../../../config/database.config";

export interface CartRow {
  id: string;
  userId: string;
  expiresAt: Date;
  items: Array<{ id: string; variantId: string; quantity: number; unitPriceCents: number }>;
}

const CART_SELECT = {
  id: true,
  userId: true,
  expiresAt: true,
  items: { orderBy: { createdAt: "asc" as const }, select: { id: true, variantId: true, quantity: true, unitPriceCents: true } },
};

export class CartRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // findActive => carrito ACTIVE más reciente del usuario (regla: uno por usuario)
  public async findActive(userId: string): Promise<CartRow | null> {
    return this.prisma.cart.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: { createdAt: "desc" }, select: CART_SELECT });
  }

  public async create(userId: string, expiresAt: Date): Promise<CartRow> {
    return this.prisma.cart.create({ data: { userId, expiresAt }, select: CART_SELECT });
  }

  // markAbandoned => carrito vencido: se conserva como ABANDONED (insumo para campañas de recuperación)
  public async markAbandoned(cartId: string): Promise<void> {
    await this.prisma.cart.update({ where: { id: cartId }, data: { status: "ABANDONED" } });
  }

  public async touch(cartId: string, expiresAt: Date): Promise<void> {
    await this.prisma.cart.update({ where: { id: cartId }, data: { expiresAt } });
  }

  // upsertItem => si la variante ya está en el carrito suma la cantidad; si no, crea la línea (@@unique cartId+variantId)
  public async upsertItem(cartId: string, variantId: string, quantity: number, unitPriceCents: number): Promise<void> {
    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId, variantId } },
      update: { quantity, unitPriceCents },
      create: { cartId, variantId, quantity, unitPriceCents },
    });
  }

  public async updateQuantity(itemId: string, quantity: number): Promise<void> {
    await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
  }

  public async deleteItem(itemId: string): Promise<void> {
    await this.prisma.cartItem.delete({ where: { id: itemId } });
  }

  public async clear(cartId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({ where: { cartId } });
  }

  // activeCartUserIds => RF-07.5 usuarios con el producto en su carrito ACTIVO (avisos de precio y poco stock)
  public async activeCartUserIds(productId: string): Promise<string[]> {
    const rows = await this.prisma.cart.findMany({ where: { status: "ACTIVE", items: { some: { variant: { productId } } } }, select: { userId: true }, distinct: ["userId"] });
    return rows.map((row) => row.userId);
  }

  // findAbandoned => RF-07.6 carritos ACTIVOS con productos, sin actividad desde "before" y sin recordatorio posterior
  // a su última actividad (un carrito retomado y vuelto a abandonar recibe otro recordatorio, nunca dos seguidos)
  public async findAbandoned(before: Date, limit: number): Promise<Array<{ id: string; userId: string; itemCount: number }>> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; userId: string; itemCount: bigint }>>`
      SELECT c."id", c."userId", SUM(i."quantity") AS "itemCount"
      FROM "carts" c JOIN "cart_items" i ON i."cartId" = c."id"
      WHERE c."status" = 'ACTIVE' AND c."updatedAt" < ${before} AND (c."remindedAt" IS NULL OR c."remindedAt" < c."updatedAt")
      GROUP BY c."id" LIMIT ${limit}`;
    return rows.map((row) => ({ ...row, itemCount: Number(row.itemCount) }));
  }

  // markReminded => "updatedAt" se fija igual al valor anterior para que el recordatorio no cuente como actividad
  public async markReminded(cartId: string): Promise<void> {
    await this.prisma.$executeRaw`UPDATE "carts" SET "remindedAt" = NOW(), "updatedAt" = "updatedAt" WHERE "id" = ${cartId}`;
  }
}

export const cartRepository = new CartRepository(prisma);
