// loyalty.repository.ts => persistencia del programa de fidelidad: cuenta, libro mayor (ledger) y badges.
import type { LoyaltyTier, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import { planFifoConsumption, POINTS_VALIDITY_MONTHS, tierFor } from "../model/loyalty.model";
import { InsufficientPointsException } from "../exception/loyalty.exception";
import { MESSAGES, type LoyaltyReason, type LoyaltyReasonCode, type LoyaltyReasonParams } from "../../../shared/constants/messages.constants";
import { DEFAULT_LOCALE } from "../../../shared/util/i18n.util";

// reasonColumns => concepto -> columnas: código + parámetros (se traducen al leer) y texto por defecto para auditoría
const renderReasonText = <K extends LoyaltyReasonCode>(reason: { code: K; params: LoyaltyReasonParams[K] }) =>
  MESSAGES[DEFAULT_LOCALE].loyaltyReasons[reason.code](reason.params);
function reasonColumns(reason: LoyaltyReason): { reason: string; reasonCode: string | null; reasonParams?: Prisma.InputJsonValue } {
  if (typeof reason === "string") return { reason, reasonCode: null }; // Texto libre: sin parámetros
  return { reason: renderReasonText(reason), reasonCode: reason.code, reasonParams: reason.params as Prisma.InputJsonValue };
}

export type AccountRow = Prisma.LoyaltyAccountGetPayload<{ include: { user: { select: { walletAddress: true } } } }>;

export class LoyaltyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async findById(id: string): Promise<AccountRow | null> {
    return this.prisma.loyaltyAccount.findUnique({ where: { id }, include: { user: { select: { walletAddress: true } } } });
  }

  // findOrCreateByUser => cuentas de usuarios anteriores al programa se crean al primer acceso (lazy)
  public async findOrCreateByUser(userId: string): Promise<AccountRow> {
    return this.prisma.loyaltyAccount.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: { user: { select: { walletAddress: true } } },
    });
  }

  public async recentTransactions(accountId: string, limit: number) {
    return this.prisma.loyaltyTransaction.findMany({ where: { accountId }, orderBy: { createdAt: "desc" }, take: limit });
  }

  public async expiringPoints(accountId: string, before: Date): Promise<number> {
    const aggregate = await this.prisma.loyaltyTransaction.aggregate({
      where: { accountId, operation: "ADD", remaining: { gt: 0 }, expiresAt: { lte: before, gt: new Date() } },
      _sum: { remaining: true },
    });
    return aggregate._sum.remaining ?? 0;
  }

  // addPoints => nuevo lote que vence en 12 meses; suma saldo e historial y recalcula el nivel (atómico)
  public async addPoints(accountId: string, points: number, reason: LoyaltyReason, orderId: string | null): Promise<{ before: LoyaltyTier; after: LoyaltyTier }> {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.loyaltyAccount.findUniqueOrThrow({ where: { id: accountId } });
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + POINTS_VALIDITY_MONTHS);
      await tx.loyaltyTransaction.create({ data: { accountId, operation: "ADD", points, remaining: points, ...reasonColumns(reason), orderId, expiresAt } });
      const lifetimePoints = account.lifetimePoints + points;
      const after = tierFor(lifetimePoints);
      await tx.loyaltyAccount.update({ where: { id: accountId }, data: { pointsBalance: { increment: points }, lifetimePoints, tier: after } });
      return { before: account.tier, after };
    });
  }

  // subtractPoints => consume lotes FIFO (primero los que vencen antes); falla si no hay saldo
  public async subtractPoints(accountId: string, points: number, reason: LoyaltyReason, orderId: string | null, allowPartial = false): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.loyaltyAccount.findUniqueOrThrow({ where: { id: accountId } });
      if (!allowPartial && account.pointsBalance < points) throw new InsufficientPointsException(account.pointsBalance);

      const lots = await tx.loyaltyTransaction.findMany({
        where: { accountId, operation: "ADD", remaining: { gt: 0 } },
        orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
        select: { id: true, remaining: true },
      });
      const { consumptions, covered } = planFifoConsumption(lots, Math.min(points, account.pointsBalance));
      for (const consumption of consumptions) {
        await tx.loyaltyTransaction.update({ where: { id: consumption.id }, data: { remaining: { decrement: consumption.take } } });
      }
      if (covered > 0) {
        await tx.loyaltyTransaction.create({ data: { accountId, operation: "SUBTRACT", points: covered, ...reasonColumns(reason), orderId } });
        await tx.loyaltyAccount.update({ where: { id: accountId }, data: { pointsBalance: { decrement: covered } } });
      }
      return covered;
    });
  }

  // purgeExpired => "purgar puntos vencidos — acción masiva periódica": un SUBTRACT por lote vencido
  public async purgeExpired(): Promise<number> {
    const lots = await this.prisma.loyaltyTransaction.findMany({
      where: { operation: "ADD", remaining: { gt: 0 }, expiresAt: { lt: new Date() } },
      select: { id: true, accountId: true, remaining: true },
    });
    for (const lot of lots) {
      await this.prisma.$transaction([
        this.prisma.loyaltyTransaction.update({ where: { id: lot.id }, data: { remaining: 0 } }),
        this.prisma.loyaltyTransaction.create({ data: { accountId: lot.accountId, operation: "SUBTRACT", points: lot.remaining, ...reasonColumns({ code: "EXPIRATION", params: {} }) } }),
        this.prisma.loyaltyAccount.update({ where: { id: lot.accountId }, data: { pointsBalance: { decrement: lot.remaining } } }),
      ]);
    }
    return lots.reduce((sum, lot) => sum + lot.remaining, 0);
  }

  // --- RF-14.5 ranking / RF-14.9 logros y multiplicadores ---

  public async ranking(limit: number) {
    return this.prisma.loyaltyAccount.findMany({
      where: { lifetimePoints: { gt: 0 }, user: { deletedAt: null } },
      orderBy: [{ lifetimePoints: "desc" }, { createdAt: "asc" }],
      take: limit,
      select: { userId: true, tier: true, lifetimePoints: true, user: { select: { firstName: true, lastName: true } } },
    });
  }

  // positionOf => posición = cuentas con más puntos históricos + 1 (COUNT indexado, sin traer filas)
  public async positionOf(lifetimePoints: number): Promise<number> {
    return (await this.prisma.loyaltyAccount.count({ where: { lifetimePoints: { gt: lifetimePoints } } })) + 1;
  }

  public unlockedAchievements(userId: string) {
    return this.prisma.userAchievement.findMany({ where: { userId } });
  }

  // unlockAchievement => true si se desbloqueó ahora (false si ya existía: idempotente por la PK userId+code)
  public async unlockAchievement(userId: string, code: string): Promise<boolean> {
    const created = await this.prisma.userAchievement.createMany({ data: [{ userId, code }], skipDuplicates: true });
    return created.count === 1;
  }

  public activeMultiplier(now: Date) {
    return this.prisma.pointsMultiplier.findFirst({ where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } }, orderBy: { multiplier: "desc" } });
  }

  public listMultipliers() {
    return this.prisma.pointsMultiplier.findMany({ orderBy: { startsAt: "desc" } });
  }

  public createMultiplier(data: Prisma.PointsMultiplierCreateInput) {
    return this.prisma.pointsMultiplier.create({ data });
  }

  public updateMultiplier(id: string, isActive: boolean) {
    return this.prisma.pointsMultiplier.update({ where: { id }, data: { isActive } });
  }

  // hasReasonSince => evita repetir un premio (ej. cumpleaños una vez al año)
  public async hasReasonSince(accountId: string, reasonCode: string, since: Date): Promise<boolean> {
    return (await this.prisma.loyaltyTransaction.count({ where: { accountId, reasonCode, createdAt: { gte: since } } })) > 0;
  }

  // accountsWithExpiring => RF-14.7 cuentas con puntos que vencen antes de "before" (para el recordatorio)
  public async accountsWithExpiring(before: Date) {
    const rows = await this.prisma.loyaltyTransaction.groupBy({
      by: ["accountId"],
      where: { operation: "ADD", remaining: { gt: 0 }, expiresAt: { lte: before, gt: new Date() } },
      _sum: { remaining: true },
    });
    const accounts = await this.prisma.loyaltyAccount.findMany({ where: { id: { in: rows.map((row) => row.accountId) } }, select: { id: true, userId: true } });
    const userBy = new Map(accounts.map((account) => [account.id, account.userId]));
    return rows.map((row) => ({ accountId: row.accountId, userId: userBy.get(row.accountId) ?? "", points: row._sum.remaining ?? 0 })).filter((row) => row.userId);
  }

  // --- Badges NFT ---

  public async listBadges(accountId: string) {
    return this.prisma.nftBadge.findMany({ where: { accountId }, orderBy: { createdAt: "asc" } });
  }

  // upsertPendingBadge => un badge por nivel y cuenta (@@unique): reintentar reutiliza el registro
  public async upsertPendingBadge(accountId: string, tier: LoyaltyTier, name: string, imageUrl: string) {
    return this.prisma.nftBadge.upsert({
      where: { accountId_tier: { accountId, tier } },
      update: {},
      create: { accountId, tier, name, imageUrl },
    });
  }

  public async updateBadge(id: string, data: Prisma.NftBadgeUpdateInput) {
    return this.prisma.nftBadge.update({ where: { id }, data });
  }
}

export const loyaltyRepository = new LoyaltyRepository(prisma);
