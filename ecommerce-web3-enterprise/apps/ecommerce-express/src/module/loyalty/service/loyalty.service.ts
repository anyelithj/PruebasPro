// loyalty.service.ts => programa de fidelidad (sprint 4.1): puntos por compra entregada, ajustes, vencimientos,
// niveles y NFT badges (Web3) al subir de nivel.
import type { LoyaltyTier } from "@prisma/client";
import { loyaltyRepository, type AccountRow, type LoyaltyRepository } from "../repository/loyalty.repository";
import { ACHIEVEMENTS, ACTION_POINTS, applyMultiplier, isHigherTier, maskName, maxRedeemablePoints, newAchievements, nextTier, pointsForAmount, TIER_BENEFITS, type PointsAction, type TierBenefits } from "../model/loyalty.model";
import { verifyBadgeTransfer } from "../util/nft.util";
import { authEvents } from "../../auth/service/auth.service";
import { createPersonalCoupon } from "../../coupon/service/coupon.service";
import { notificationService } from "../../notification/service/notification.service";
import { prisma } from "../../../config/database.config";
import { redis } from "../../../config/redis.config";
import { randomCode } from "../../../shared/util/crypto.util";
import { ForbiddenException, NotFoundException, UnprocessableException } from "../../../shared/filter/http-exception.filter";
import { MESSAGES, type LoyaltyReason } from "../../../shared/constants/messages.constants";
import { DEFAULT_LOCALE, isLocale } from "../../../shared/util/i18n.util";
import type { AchievementDto, RankingDto } from "../dto/loyalty.dto";

const EXPIRY_REMINDER_DAYS = 7; // RF-14.7 aviso una semana antes de vencer
const DAY_MS = 86_400_000;
import { LoyaltyAccountNotFoundException, TierNotReachedException, WalletRequiredException } from "../exception/loyalty.exception";
import type { LoyaltyAccountDto, NftBadgeDto } from "../dto/loyalty.dto";
import type { AdjustPointsInput } from "../schema/loyalty.schema";
import { mintBadge, uploadMetadata } from "../util/nft.util";
import { commerceEvents } from "../../order/event/order.event";
import { appConfig } from "../../../config/app.config";
import { addDays } from "../../../shared/util/date.util";
import { isAdmin } from "../../../shared/decorator/auth.decorator";
import { logger } from "../../../shared/middleware/logger.middleware";
import { renderLoyaltyReason } from "../../../shared/constants/messages.constants";
import type { Locale } from "../../../shared/util/i18n.util";

interface Viewer {
  id: string;
  roles: string[];
}

// Arte de cada insignia (en producción: assets propios en Cloudinary/IPFS)
const BADGE_ART: Record<LoyaltyTier, string> = {
  BRONZE: "https://res.cloudinary.com/demo/image/upload/badges/bronze.png",
  SILVER: "https://res.cloudinary.com/demo/image/upload/badges/silver.png",
  GOLD: "https://res.cloudinary.com/demo/image/upload/badges/gold.png",
  DIAMOND: "https://res.cloudinary.com/demo/image/upload/badges/diamond.png",
  PLATINUM: "https://res.cloudinary.com/demo/image/upload/badges/platinum.png",
};

export class LoyaltyService {
  constructor(private readonly repository: LoyaltyRepository) {}

  // getMyAccount => atajo del Account hub: cuenta del usuario autenticado
  // "locale" => idioma de quien consulta: el concepto de cada movimiento se traduce al leer
  public async getMyAccount(userId: string, locale: Locale): Promise<LoyaltyAccountDto> {
    return this.toDto(await this.repository.findOrCreateByUser(userId), locale);
  }

  // redemptionFor => RF-07.3/08.7 cuántos puntos puede canjear el usuario sobre "payableCents" y cuánto valen
  public async redemptionFor(userId: string, payableCents: number): Promise<{ balance: number; maxPoints: number; pointValueCents: number }> {
    const account = await this.repository.findOrCreateByUser(userId);
    const pointValueCents = appConfig.LOYALTY_POINT_VALUE_CENTS;
    return { balance: account.pointsBalance, maxPoints: maxRedeemablePoints(account.pointsBalance, payableCents, pointValueCents, appConfig.LOYALTY_MAX_REDEEM_PERCENT), pointValueCents };
  }

  // getLoyaltyAccountById => "saldo de puntos y nivel de fidelidad por ID" (dueño o admin)
  public async getLoyaltyAccountById(id: string, viewer: Viewer, locale: Locale): Promise<LoyaltyAccountDto> {
    return this.toDto(await this.findOwned(id, viewer), locale);
  }

  // updateLoyaltyAccount => "añadir/restar puntos — body: { delta, operation }" (admin)
  public async adjustPoints(id: string, input: AdjustPointsInput, locale: Locale): Promise<LoyaltyAccountDto> {
    const account = await this.repository.findById(id);
    if (!account) throw new LoyaltyAccountNotFoundException(id);
    if (input.operation === "ADD") {
      const change = await this.repository.addPoints(id, input.delta, input.reason, null);
      await this.onTierChange(account, change.before, change.after);
    } else {
      await this.repository.subtractPoints(id, input.delta, input.reason, null);
    }
    return this.toDto((await this.repository.findById(id)) as AccountRow, locale);
  }

  // deleteAllLoyaltyAccounts => "purgar puntos vencidos — acción masiva periódica" (admin o job)
  public async purgeExpiredPoints(): Promise<{ purgedPoints: number }> {
    return { purgedPoints: await this.repository.purgeExpired() };
  }

  // listNFTBadges => "listar badges del usuario con metadata IPFS blockchain"
  public async listBadges(id: string, viewer: Viewer): Promise<NftBadgeDto[]> {
    const account = await this.findOwned(id, viewer);
    return (await this.repository.listBadges(account.id)).map(toBadgeDto);
  }

  // createNFTBadge => "mintear NFT badge en blockchain para usuario específico"
  public async mintBadgeFor(id: string, viewer: Viewer, tier?: LoyaltyTier): Promise<NftBadgeDto> {
    const account = await this.findOwned(id, viewer);
    const targetTier = tier ?? account.tier;
    if (isHigherTier(targetTier, account.tier)) throw new TierNotReachedException();
    if (!account.user.walletAddress) throw new WalletRequiredException();
    return this.mint(account, targetTier);
  }

  // registerSubscribers => puntos al ENTREGAR (no al pagar: evita puntos de pedidos que luego se devuelven)
  public registerSubscribers(): void {
    commerceEvents.on("order.status-changed", async (event) => {
      if (event.to !== "DELIVERED") return;
      // RF-14.9 evento especial vigente => puntos multiplicados
      const multiplier = await this.repository.activeMultiplier(new Date());
      const points = applyMultiplier(pointsForAmount(event.totalCents, appConfig.LOYALTY_POINTS_PER_UNIT), multiplier?.multiplier ?? 1);
      if (points > 0) await this.award(event.userId, points, { code: "PURCHASE", params: { orderNumber: event.orderNumber } }, event.orderId);
      await this.rewardReferrer(event.userId);
      await this.checkAchievements(event.userId);
    });

    // RF-14.1 registro: puntos de bienvenida + cupón de bienvenida (RF-13.3)
    authEvents.on("user.welcome", async (event) => {
      await this.awardAction(event.userId, "SIGNUP", { code: "SIGNUP", params: {} });
      const code = await createPersonalCoupon({ userId: event.userId, origin: "WELCOME", type: "PERCENTAGE", value: 10, maxDiscountCents: 5_000_000, validDays: 30, description: "Cupón de bienvenida (10 %)" });
      await notificationService.notify(event.userId, { type: "PROMOTION", message: { key: "couponGranted", params: { code, origin: "WELCOME" } }, url: "/products" });
    });

    // RF-14.1 reseña publicada con fotos => puntos; toda reseña cuenta para los logros (RF-14.9)
    commerceEvents.on("review.published", async (event) => {
      if (event.hasPhotos && (await this.once(`loyalty:review-photo:${event.reviewId}`))) await this.awardAction(event.userId, "REVIEW_PHOTO", { code: "REVIEW_PHOTO", params: {} });
      await this.checkAchievements(event.userId);
    });

    // RF-08.7 pedido colocado con puntos => se descuentan del saldo (FIFO por vencimiento). Si el saldo ya no alcanza
    // (se canjeó en otro pedido mientras tanto) se descuenta lo que haya: el pedido ya está pagado y no se revierte
    commerceEvents.on("order.placed", async (event) => {
      if (!event.pointsRedeemed) return;
      const account = await this.repository.findOrCreateByUser(event.userId);
      await this.repository.subtractPoints(account.id, event.pointsRedeemed, { code: "REDEMPTION", params: { orderNumber: event.orderNumber } }, event.orderId, true);
    });

    // Devolución procesada => se descuentan (hasta donde alcance el saldo) los puntos proporcionales
    commerceEvents.on("refund.updated", async (event) => {
      if (event.status !== "PROCESSED") return;
      const points = pointsForAmount(event.amountCents, appConfig.LOYALTY_POINTS_PER_UNIT);
      if (points <= 0) return;
      const account = await this.repository.findOrCreateByUser(event.userId);
      await this.repository.subtractPoints(account.id, points, { code: "REFUND_ADJUSTMENT", params: {} }, event.orderId, true);
    });
  }

  // ---------- RF-14.1 puntos por acciones ----------

  // award => suma puntos, avisa en tiempo real (RF-14.7) y procesa la subida de nivel (DRY: compras, acciones y logros)
  private async award(userId: string, points: number, reason: Exclude<LoyaltyReason, string>, orderId: string | null = null): Promise<void> {
    const account = await this.repository.findOrCreateByUser(userId);
    const change = await this.repository.addPoints(account.id, points, reason, orderId);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { locale: true } });
    const locale = isLocale(user?.locale) ? user.locale : DEFAULT_LOCALE;
    const text = renderLoyaltyReason(locale, reason.code, reason.params, "");
    await notificationService.notify(userId, { type: "LOYALTY", message: { key: "pointsEarned", params: { points, reason: text } }, url: "/account/loyalty", channels: ["IN_APP", "PUSH"] });
    await this.onTierChange(account, change.before, change.after);
  }

  private awardAction(userId: string, action: PointsAction, reason: Exclude<LoyaltyReason, string>): Promise<void> {
    return this.award(userId, ACTION_POINTS[action], reason);
  }

  // once => true solo la primera vez para una clave (Redis SET NX): evita premios repetidos por eventos duplicados
  private async once(key: string, ttlSeconds = 365 * 86_400): Promise<boolean> {
    return (await redis.set(key, "1", "EX", ttlSeconds, "NX").catch(() => "OK")) === "OK";
  }

  // share => RF-14.1 compartir un producto: una vez por producto y red al día (anti abuso)
  public async share(userId: string, productId: string, network: string): Promise<{ awarded: boolean; points: number }> {
    const day = new Date().toISOString().slice(0, 10);
    if (!(await this.once(`loyalty:share:${userId}:${productId}:${network}:${day}`, DAY_MS / 1000))) return { awarded: false, points: 0 };
    await this.awardAction(userId, "SOCIAL_SHARE", { code: "SOCIAL_SHARE", params: { network } });
    await redis.incr(`loyalty:shares:${userId}`).catch(() => 0); // Contador para el logro SOCIAL_SHARER
    await this.checkAchievements(userId);
    return { awarded: true, points: ACTION_POINTS.SOCIAL_SHARE };
  }

  // referralCode => RF-14.1 código para referir amigos (se crea la primera vez que se pide)
  public async referralCode(userId: string): Promise<{ code: string; points: number }> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
    if (user?.referralCode) return { code: user.referralCode, points: ACTION_POINTS.REFERRAL };
    const code = randomCode(8);
    await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
    return { code, points: ACTION_POINTS.REFERRAL };
  }

  // rewardReferrer => el amigo referido recibió su PRIMER pedido => puntos para quien lo refirió (una sola vez)
  private async rewardReferrer(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { referredById: true, firstName: true, lastName: true } });
    if (!user?.referredById) return;
    const delivered = await prisma.order.count({ where: { userId, status: "DELIVERED" } });
    if (delivered !== 1 || !(await this.once(`loyalty:referral:${userId}`))) return;
    await this.awardAction(user.referredById, "REFERRAL", { code: "REFERRAL", params: { friend: maskName(user.firstName, user.lastName) } });
    await this.checkAchievements(user.referredById);
  }

  // ---------- RF-14.9 logros y multiplicadores ----------

  // checkAchievements => calcula las estadísticas y desbloquea (con puntos) los logros nuevos
  public async checkAchievements(userId: string): Promise<void> {
    const [orders, reviews, photoReviews, referrals, shares, account, unlocked] = await Promise.all([
      prisma.order.count({ where: { userId, status: "DELIVERED" } }),
      prisma.review.count({ where: { userId, status: "APPROVED" } }),
      prisma.review.count({ where: { userId, status: "APPROVED", NOT: { photoUrls: { isEmpty: true } } } }),
      prisma.user.count({ where: { referredById: userId, orders: { some: { status: "DELIVERED" } } } }),
      redis.get(`loyalty:shares:${userId}`).then(Number).catch(() => 0),
      this.repository.findOrCreateByUser(userId),
      this.repository.unlockedAchievements(userId),
    ]);
    const fresh = newAchievements({ orders, reviews, photoReviews, referrals, shares: shares || 0, tier: account.tier }, new Set(unlocked.map((row) => row.code)));
    for (const achievement of fresh) {
      if (!(await this.repository.unlockAchievement(userId, achievement.code))) continue;
      await notificationService.notify(userId, { type: "LOYALTY", message: { key: "achievementUnlocked", params: { code: achievement.code } }, url: "/account/loyalty" });
      await this.award(userId, achievement.points, { code: "ACHIEVEMENT", params: { code: achievement.code } });
    }
  }

  // achievements => RF-14.9 todos los logros con su estado (bloqueado/desbloqueado) en el idioma pedido
  public async achievements(userId: string, locale: Locale): Promise<AchievementDto[]> {
    const unlocked = new Map((await this.repository.unlockedAchievements(userId)).map((row) => [row.code, row.unlockedAt]));
    return ACHIEVEMENTS.map((achievement) => ({ code: achievement.code, name: MESSAGES[locale].achievements[achievement.code], points: achievement.points, unlockedAt: unlocked.get(achievement.code) ?? null }));
  }

  public listMultipliers() {
    return this.repository.listMultipliers();
  }
  public createMultiplier(input: { name: string; multiplier: number; startsAt: Date; endsAt: Date; isActive: boolean }) {
    return this.repository.createMultiplier(input);
  }
  public updateMultiplier(id: string, isActive: boolean) {
    return this.repository.updateMultiplier(id, isActive);
  }

  // ---------- RF-14.4 beneficios / RF-14.5 ranking ----------

  // benefitsFor => beneficios del nivel del usuario (los usan el checkout y el carrito)
  public async benefitsFor(userId: string): Promise<TierBenefits & { tier: LoyaltyTier }> {
    const account = await this.repository.findOrCreateByUser(userId);
    return { tier: account.tier, ...TIER_BENEFITS[account.tier] };
  }

  // personalShopper => RF-14.4 solicitud de asesoría (solo niveles con el beneficio): avisa al equipo administrador
  public async personalShopper(userId: string, message: string): Promise<{ sent: true }> {
    const benefits = await this.benefitsFor(userId);
    if (!benefits.personalShopper) throw new ForbiddenException("El personal shopper es un beneficio del nivel Platino");
    const [user, admins] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } }),
      prisma.user.findMany({ where: { deletedAt: null, isActive: true, roles: { some: { role: { name: "ADMIN" } } } }, select: { id: true } }),
    ]);
    const name = `${user?.firstName ?? ""} ${user?.lastName ?? ""} <${user?.email ?? ""}>`.trim();
    await notificationService.broadcast(admins.map((admin) => admin.id), { type: "SYSTEM", message: { key: "personalShopperRequest", params: { name, message } }, url: "/dashboard/customers" });
    return { sent: true };
  }

  // ranking => RF-14.5 top por puntos históricos + la posición del usuario (nombres enmascarados: privacidad)
  public async ranking(userId: string, limit: number): Promise<RankingDto> {
    const [rows, account] = await Promise.all([this.repository.ranking(limit), this.repository.findOrCreateByUser(userId)]);
    return {
      top: rows.map((row, index) => ({ position: index + 1, name: maskName(row.user.firstName, row.user.lastName), tier: row.tier, lifetimePoints: row.lifetimePoints })),
      me: account.lifetimePoints > 0 ? { position: await this.repository.positionOf(account.lifetimePoints), lifetimePoints: account.lifetimePoints } : null,
    };
  }

  // ---------- RF-14.8 transferencia de insignias ----------

  public async transferBadge(accountId: string, badgeId: string, viewer: Viewer, toAddress: string, txHash: string): Promise<NftBadgeDto> {
    const account = await this.findOwned(accountId, viewer);
    const badge = (await this.repository.listBadges(account.id)).find((entry) => entry.id === badgeId);
    if (!badge) throw new NotFoundException("NftBadge", badgeId);
    if (badge.status !== "MINTED" || !badge.contractAddress || !badge.tokenId) throw new UnprocessableException("La insignia aún no está minteada", "BADGE_NOT_MINTED");
    if (!(await verifyBadgeTransfer(badge.contractAddress, badge.tokenId, txHash, toAddress))) {
      throw new UnprocessableException("No encontramos la transferencia confirmada hacia esa wallet", "BADGE_TRANSFER_NOT_VERIFIED");
    }
    return toBadgeDto(await this.repository.updateBadge(badge.id, { ownerAddress: toAddress, transferTxHash: txHash }));
  }

  // ---------- Jobs diarios ----------

  // birthdays => RF-13.3 / RF-14.1 cumpleañeros de hoy: puntos + cupón (una vez al año)
  public async birthdays(): Promise<number> {
    const today = new Date();
    const users = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "users" WHERE "birthDate" IS NOT NULL AND "deletedAt" IS NULL
      AND EXTRACT(MONTH FROM "birthDate") = ${today.getMonth() + 1} AND EXTRACT(DAY FROM "birthDate") = ${today.getDate()}`;
    let rewarded = 0;
    const yearStart = new Date(today.getFullYear(), 0, 1);
    for (const user of users) {
      const account = await this.repository.findOrCreateByUser(user.id);
      if (await this.repository.hasReasonSince(account.id, "BIRTHDAY", yearStart)) continue;
      await this.awardAction(user.id, "BIRTHDAY", { code: "BIRTHDAY", params: {} });
      const code = await createPersonalCoupon({ userId: user.id, origin: "BIRTHDAY", type: "PERCENTAGE", value: 15, maxDiscountCents: 10_000_000, validDays: 15, description: "Regalo de cumpleaños (15 %)" });
      await notificationService.notify(user.id, { type: "PROMOTION", message: { key: "couponGranted", params: { code, origin: "BIRTHDAY" } }, url: "/products" });
      rewarded += 1;
    }
    return rewarded;
  }

  // expiringReminders => RF-14.7 recuerda los puntos que vencen en 7 días (un aviso por cuenta y semana)
  public async expiringReminders(): Promise<number> {
    const week = Math.floor(Date.now() / (7 * DAY_MS));
    let sent = 0;
    for (const row of await this.repository.accountsWithExpiring(addDays(new Date(), EXPIRY_REMINDER_DAYS))) {
      if (!(await this.once(`loyalty:expiring:${row.accountId}:${week}`, 8 * 86_400))) continue;
      await notificationService.notify(row.userId, { type: "LOYALTY", message: { key: "pointsExpiring", params: { points: row.points, days: EXPIRY_REMINDER_DAYS } }, url: "/account/loyalty" });
      sent += 1;
    }
    return sent;
  }

  // onTierChange => al subir de nivel: evento + badge (el minteo es best-effort: si falla queda FAILED y se reintenta)
  private async onTierChange(account: AccountRow, before: LoyaltyTier, after: LoyaltyTier): Promise<void> {
    if (!isHigherTier(after, before)) return;
    commerceEvents.emit("loyalty.tier-upgraded", { userId: account.userId, accountId: account.id, tier: after });
    if (!account.user.walletAddress) return; // Sin wallet: el badge se podrá mintear después
    await this.mint(account, after).catch((error: unknown) => logger.warn("badge_mint_deferred", { accountId: account.id, error }));
  }

  // mint => metadata a IPFS + safeMint ERC-721; registra el resultado en la tabla nft_badges
  private async mint(account: AccountRow, tier: LoyaltyTier): Promise<NftBadgeDto> {
    const name = `Nivel ${tier} · eCommerce Web3`;
    const badge = await this.repository.upsertPendingBadge(account.id, tier, name, BADGE_ART[tier]);
    if (badge.status === "MINTED") return toBadgeDto(badge); // Idempotente: un nivel se certifica una vez

    try {
      const metadataUri = await uploadMetadata({
        name,
        description: `Insignia de fidelidad nivel ${tier} otorgada por eCommerce Web3`,
        image: BADGE_ART[tier],
        attributes: [
          { trait_type: "Tier", value: tier },
          { trait_type: "Lifetime points", value: account.lifetimePoints },
        ],
      });
      const result = await mintBadge(account.user.walletAddress as string, metadataUri);
      const minted = await this.repository.updateBadge(badge.id, {
        status: "MINTED",
        metadataUri,
        tokenId: result.tokenId,
        txHash: result.txHash,
        contractAddress: result.contractAddress,
        mintedAt: new Date(),
        failureReason: null,
      });
      commerceEvents.emit("loyalty.badge-minted", { userId: account.userId, badgeId: badge.id, tier, txHash: result.txHash });
      return toBadgeDto(minted);
    } catch (error) {
      await this.repository.updateBadge(badge.id, { status: "FAILED", failureReason: error instanceof Error ? error.message : "Error desconocido" });
      throw error; // Se propaga al cliente (503 sin configuración, 502 si falla la blockchain)
    }
  }

  private async findOwned(id: string, viewer: Viewer): Promise<AccountRow> {
    const account = await this.repository.findById(id);
    if (!account || (account.userId !== viewer.id && !isAdmin(viewer))) throw new LoyaltyAccountNotFoundException(id);
    return account;
  }

  private async toDto(account: AccountRow, locale: Locale): Promise<LoyaltyAccountDto> {
    const [transactions, expiringSoon, multiplier] = await Promise.all([
      this.repository.recentTransactions(account.id, 20),
      this.repository.expiringPoints(account.id, addDays(new Date(), 30)),
      this.repository.activeMultiplier(new Date()),
    ]);
    return {
      id: account.id,
      userId: account.userId,
      pointsBalance: account.pointsBalance,
      lifetimePoints: account.lifetimePoints,
      tier: account.tier,
      nextTier: nextTier(account.lifetimePoints),
      expiringSoon,
      recentTransactions: transactions.map(({ id, operation, points, reason, reasonCode, reasonParams, orderId, expiresAt, createdAt }) => ({
        id,
        operation,
        points,
        reason: renderLoyaltyReason(locale, reasonCode, reasonParams, reason), // Texto libre de admin: tal cual
        orderId,
        expiresAt,
        createdAt,
      })),
      benefits: TIER_BENEFITS[account.tier],
      activeMultiplier: multiplier ? { name: multiplier.name, multiplier: multiplier.multiplier, endsAt: multiplier.endsAt } : null,
    };
  }
}

// toBadgeDto => agrega la URL http del gateway IPFS (los navegadores no abren "ipfs://" directamente)
function toBadgeDto(badge: {
  id: string;
  tier: LoyaltyTier;
  name: string;
  imageUrl: string;
  metadataUri: string | null;
  contractAddress: string | null;
  tokenId: string | null;
  txHash: string | null;
  status: NftBadgeDto["status"];
  mintedAt: Date | null;
  ownerAddress: string | null;
  transferTxHash: string | null;
}): NftBadgeDto {
  return {
    ...badge,
    metadataUrl: badge.metadataUri ? badge.metadataUri.replace("ipfs://", `${appConfig.IPFS_GATEWAY_URL}/`) : null,
  };
}

export const loyaltyService = new LoyaltyService(loyaltyRepository);
