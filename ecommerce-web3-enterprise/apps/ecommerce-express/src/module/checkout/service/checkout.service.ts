// checkout.service.ts => Saga de checkout (sprint 3.2): iniciar (reserva stock) → dirección/envío (PATCH)
// → pago (módulo Payment) → pedido (módulo Order). También cancela y expira sesiones liberando el stock.
import { checkoutRepository, type CheckoutRepository, type CheckoutRow } from "../repository/checkout.repository";
import { computeTotals, isOpen } from "../model/checkout.model";
import {
  CheckoutClosedException,
  CheckoutNotFoundException,
  EmptyCartException,
  InvalidShippingRateException,
} from "../exception/checkout.exception";
import type { CheckoutSessionDto } from "../dto/checkout.dto";
import { CheckoutItemsSchema, ShippingAddressSnapshotSchema, type CheckoutItemSnapshot, type InitCheckoutInput } from "../schema/checkout.schema";
import { loyaltyService } from "../../loyalty/service/loyalty.service"; // RF-07.3 / RF-08.7 canje de puntos
import { promotionService } from "../../coupon/service/promotion.service"; // RF-13.4/13.7/13.8 promociones automáticas
import type { AppliedPromotion } from "../../coupon/model/promotion.model";
import type { Prisma } from "@prisma/client";
import { cartService } from "../../cart/service/cart.service";
import { couponService } from "../../coupon/service/coupon.service";
import { collectionService } from "../../collection/service/collection.service"; // RF-05.5 descuento por look
import { shippingService } from "../../shipping/service/shipping.service";
import { UnprocessableException, NotFoundException } from "../../../shared/filter/http-exception.filter";
import { prisma } from "../../../config/database.config";
import { appConfig } from "../../../config/app.config";
import { addMinutes } from "../../../shared/util/date.util";
import { logger } from "../../../shared/middleware/logger.middleware";

export class CheckoutService {
  constructor(private readonly repository: CheckoutRepository) {}

  // initCheckout => "iniciar sesión checkout con ítems del carrito"
  public async initCheckout(userId: string, input: InitCheckoutInput = {}): Promise<CheckoutSessionDto> {
    const { couponCode } = input;
    const cart = await cartService.getActiveCart(userId);
    if (cart.items.length === 0) throw new EmptyCartException();
    const blocked = cart.items.find((item) => !item.purchasable);
    if (blocked) throw new UnprocessableException(`${blocked.productName} no está disponible en la cantidad pedida`, "CART_ITEM_UNAVAILABLE", { itemId: blocked.id });

    // Una sesión abierta a la vez: las anteriores se abandonan y liberan su stock
    for (const open of await this.repository.findOpenByUser(userId)) {
      await this.repository.releaseAndClose(open.id, CheckoutItemsSchema.parse(open.items), "ABANDONED");
    }

    // Snapshot inmutable de los ítems con el precio VIGENTE (el total ya no cambia aunque cambie el catálogo)
    const weights = await prisma.productVariant.findMany({ where: { id: { in: cart.items.map((item) => item.variantId) } }, select: { id: true, weightGrams: true } });
    const weightById = new Map(weights.map((variant) => [variant.id, variant.weightGrams]));
    const items: CheckoutItemSnapshot[] = cart.items.map((item) => ({
      variantId: item.variantId,
      productId: item.productId,
      productName: item.productName,
      variantName: item.variantName,
      sku: item.sku,
      imageUrl: item.imageUrl,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      weightGrams: weightById.get(item.variantId) ?? 0,
    }));

    const coupon = couponCode ? await couponService.applyToCheckout(couponCode, cart.subtotalCents, userId, items) : null;
    const look = await collectionService.lookDiscountFor(items); // RF-05.5: se suma al cupón (el tope es el subtotal)
    const auto = await this.automaticDiscounts(userId, items, cart.subtotalCents); // RF-13 promociones + RF-14.4 nivel
    const discount = await this.withPoints(userId, cart.subtotalCents, (coupon?.discountCents ?? 0) + look.discountCents + auto.discountCents, input.points ?? 0);
    const session = await this.repository.createWithReservation({
      userId,
      cartId: cart.id,
      items,
      totals: computeTotals({ subtotalCents: cart.subtotalCents, discountCents: discount.discountCents, shippingCents: 0, taxRate: appConfig.TAX_RATE }),
      couponId: coupon?.couponId ?? null,
      currency: cart.currency,
      expiresAt: addMinutes(new Date(), appConfig.CHECKOUT_TTL_MINUTES),
      pointsRedeemed: discount.pointsRedeemed,
      promotions: auto.applied,
      channel: input.channel ?? "WEB",
      channelRef: input.channelRef ?? null,
    });
    await cartService.invalidateCache(userId);
    return this.toDto(session);
  }

  // getCheckoutSessionById => "obtener estado completo de sesión checkout" (+ tarifas si ya hay dirección)
  public async getCheckoutSessionById(id: string, userId: string): Promise<CheckoutSessionDto> {
    const session = await this.findOwned(id, userId);
    const dto = this.toDto(session);
    if (session.addressId && isOpen(session.status)) {
      dto.shippingRates = await shippingService.quoteForAddress(userId, session.addressId, this.totalWeight(dto.items), session.subtotalCents);
    }
    return dto;
  }

  // updateCheckoutStep => "seleccionar dirección de envío — PATCH parcial" (+ tarifa y cupón)
  public async updateCheckoutStep(
    id: string,
    userId: string,
    input: { addressId: string; shippingRateCode: string; couponCode?: string | null | undefined; points?: number | null | undefined }
  ): Promise<CheckoutSessionDto> {
    const session = await this.findOwned(id, userId);
    // Solo se edita antes de pagar (PAYMENT_PENDING ya tiene un PaymentIntent por un monto fijo)
    if (session.status !== "OPEN" && session.status !== "ADDRESS_SET") throw new CheckoutClosedException(session.status);

    const address = await prisma.address.findFirst({ where: { id: input.addressId, userId } });
    if (!address) throw new NotFoundException("Address", input.addressId);

    const items = CheckoutItemsSchema.parse(session.items);
    const rates = await shippingService.quoteRates(address, this.totalWeight(items), session.subtotalCents);
    const rate = rates.find((option) => option.code === input.shippingRateCode);
    if (!rate) throw new InvalidShippingRateException(input.shippingRateCode);

    const { couponId, discountCents: couponCents, freeShipping } = await this.resolveCoupon(session, input.couponCode, userId);
    // RF-05.5: el descuento por look se recalcula con el snapshot de ítems (mismos precios que se cobrarán)
    // RF-08.7 puntos: undefined => se conservan los ya elegidos (revalidados), null => se quitan
    const auto = await this.automaticDiscounts(userId, items, session.subtotalCents);
    const discount = await this.withPoints(userId, session.subtotalCents, couponCents + (await collectionService.lookDiscountFor(items)).discountCents + auto.discountCents, input.points === undefined ? session.pointsRedeemed : (input.points ?? 0));
    const { discountCents } = discount;

    const shippingAddress = ShippingAddressSnapshotSchema.parse(address); // Proyección: solo campos de envío
    const updated = await this.repository.update(id, {
      status: "ADDRESS_SET",
      addressId: address.id,
      shippingAddress,
      shippingRateCode: rate.code,
      couponId,
      pointsRedeemed: discount.pointsRedeemed,
      promotions: auto.applied as unknown as Prisma.InputJsonValue,
      ...computeTotals({
        subtotalCents: session.subtotalCents,
        discountCents,
        shippingCents: freeShipping || auto.freeShipping ? 0 : rate.costCents, // Cupón o beneficio de nivel (RF-14.4)
        taxRate: appConfig.TAX_RATE,
      }),
    });
    const dto = this.toDto(updated);
    dto.shippingRates = rates;
    return dto;
  }

  // abandonCheckout => "cancelar/expirar sesión de checkout y liberar stock reservado"
  public async abandonCheckout(id: string, userId: string): Promise<void> {
    const session = await this.findOwned(id, userId);
    if (!isOpen(session.status)) throw new CheckoutClosedException(session.status);
    await this.repository.releaseAndClose(id, CheckoutItemsSchema.parse(session.items), "ABANDONED");
  }

  // markPaymentPending => lo invoca el módulo Payment al crear el cobro: extiende la reserva (15 min tarjeta/cripto;
  // la transferencia bancaria reserva más tiempo mientras el comprador consigna)
  public async markPaymentPending(id: string, minutes = 15): Promise<void> {
    await this.repository.update(id, { status: "PAYMENT_PENDING", expiresAt: addMinutes(new Date(), minutes) });
  }

  // automaticDiscounts => RF-13 promociones vigentes (2x1, masivos, escalonados, flash) + RF-14.4 descuento adicional y
  // envío gratis del nivel de fidelidad. El beneficio de nivel se calcula sobre lo que queda tras las promociones
  private async automaticDiscounts(userId: string, items: CheckoutItemSnapshot[], subtotalCents: number): Promise<{ discountCents: number; applied: AppliedPromotion[]; freeShipping: boolean }> {
    const [promo, benefits] = await Promise.all([promotionService.applyTo(items), loyaltyService.benefitsFor(userId)]);
    const tierCents = Math.floor(((subtotalCents - promo.discountCents) * benefits.extraDiscountPercent) / 100);
    return { discountCents: promo.discountCents + tierCents, applied: promo.applied, freeShipping: benefits.freeShipping };
  }

  // withPoints => RF-07.3/08.7 descuento total = cupón + look + valor de los puntos. Los puntos se VALIDAN contra el
  // saldo y el tope porcentual sobre lo que queda por pagar (422 si se piden más de los permitidos)
  private async withPoints(userId: string, subtotalCents: number, otherDiscountCents: number, points: number): Promise<{ discountCents: number; pointsRedeemed: number }> {
    const base = Math.min(subtotalCents, otherDiscountCents);
    if (points <= 0) return { discountCents: base, pointsRedeemed: 0 };
    const { maxPoints, pointValueCents } = await loyaltyService.redemptionFor(userId, subtotalCents - base);
    if (points > maxPoints) throw new UnprocessableException(`Puedes canjear como máximo ${maxPoints} puntos en esta compra`, "POINTS_EXCEEDED", { maxPoints });
    return { discountCents: Math.min(subtotalCents, base + points * pointValueCents), pointsRedeemed: points };
  }

  // requireForPayment => sesión propia y lista para pagar (dirección y envío definidos)
  public async requireForPayment(id: string, userId: string): Promise<CheckoutRow> {
    const session = await this.findOwned(id, userId);
    if (session.status !== "ADDRESS_SET" && session.status !== "PAYMENT_PENDING") {
      throw new UnprocessableException("Completa la dirección y el envío antes de pagar", "CHECKOUT_NOT_READY");
    }
    return session;
  }

  // expireStaleSessions => job periódico: libera el stock de sesiones vencidas (lo agenda server.ts)
  public async expireStaleSessions(batchSize = 100): Promise<number> {
    let expired = 0;
    for (const session of await this.repository.findExpired(batchSize)) {
      const closed = await this.repository.releaseAndClose(session.id, CheckoutItemsSchema.parse(session.items), "EXPIRED");
      if (closed) expired += 1;
    }
    if (expired > 0) logger.info("checkout_sessions_expired", { expired });
    return expired;
  }

  // resolveCoupon => undefined: se conserva (y se revalida) | null: se quita | string: se aplica el nuevo código
  private async resolveCoupon(
    session: CheckoutRow,
    couponCode: string | null | undefined,
    userId: string
  ): Promise<{ couponId: string | null; discountCents: number; freeShipping: boolean }> {
    if (couponCode === null) return { couponId: null, discountCents: 0, freeShipping: false };
    const code = couponCode ?? session.coupon?.code;
    if (!code) return { couponId: null, discountCents: 0, freeShipping: false };
    return couponService.applyToCheckout(code, session.subtotalCents, userId, CheckoutItemsSchema.parse(session.items));
  }

  private async findOwned(id: string, userId: string): Promise<CheckoutRow> {
    const session = await this.repository.findById(id);
    // Sesión ajena => 404 (no se revela que existe)
    if (!session || session.userId !== userId) throw new CheckoutNotFoundException(id);
    return session;
  }

  private totalWeight(items: CheckoutItemSnapshot[]): number {
    return items.reduce((sum, item) => sum + item.weightGrams * item.quantity, 0);
  }

  private toDto(session: CheckoutRow): CheckoutSessionDto {
    return {
      id: session.id,
      status: session.status,
      currency: session.currency,
      items: CheckoutItemsSchema.parse(session.items),
      addressId: session.addressId,
      shippingAddress: session.shippingAddress ? ShippingAddressSnapshotSchema.parse(session.shippingAddress) : null,
      shippingRateCode: session.shippingRateCode,
      couponCode: session.coupon?.code ?? null,
      subtotalCents: session.subtotalCents,
      discountCents: session.discountCents,
      shippingCents: session.shippingCents,
      taxCents: session.taxCents,
      totalCents: session.totalCents,
      expiresAt: session.expiresAt,
      orderId: session.order?.id ?? null,
      pointsRedeemed: session.pointsRedeemed,
      pointsDiscountCents: session.pointsRedeemed * appConfig.LOYALTY_POINT_VALUE_CENTS,
      promotions: (session.promotions as AppliedPromotion[] | null) ?? [], // RF-13.10 detalle de promociones aplicadas
      channel: session.channel,
    };
  }
}

export const checkoutService = new CheckoutService(checkoutRepository);
