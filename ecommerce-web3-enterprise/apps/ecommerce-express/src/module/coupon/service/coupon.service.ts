// coupon.service.ts => casos de uso de Coupon (CRUD + validación usada también por el Checkout).
import { couponRepository, type CouponRepository } from "../repository/coupon.repository";
import { COUPON_REJECTION_MESSAGES, eligibleSubtotal, evaluateCoupon, isScoped } from "../model/coupon.model";
import { prisma } from "../../../config/database.config";
import { randomCode } from "../../../shared/util/crypto.util";
import { addDays } from "../../../shared/util/date.util";

// CouponLine => línea del carrito/checkout que se evalúa contra el alcance del cupón (RF-13.2)
export interface CouponLine {
  productId: string;
  unitPriceCents: number;
  quantity: number;
}
import { CouponNotApplicableException, CouponNotFoundException } from "../exception/coupon.exception";
import type { CouponDto, CouponValidationDto, CouponWithMetricsDto } from "../dto/coupon.dto";
import type { CreateCouponInput, UpdateCouponInput } from "../schema/coupon.schema";
import { buildPaginationMeta, toPageParams, type PaginationQuery } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";
import { ConflictException } from "../../../shared/filter/http-exception.filter";

export class CouponService {
  constructor(private readonly repository: CouponRepository) {}

  // listCoupons => "listar cupones activos con métricas"
  public async listCoupons(query: PaginationQuery & { active?: boolean | undefined }): Promise<{ items: CouponWithMetricsDto[]; meta: PaginationMeta }> {
    const page = toPageParams(query);
    const { items, total } = await this.repository.findMany(query.active, page);
    return { items, meta: buildPaginationMeta(page, total) };
  }

  public async getCouponById(id: string): Promise<CouponDto> {
    const coupon = await this.repository.findById(id);
    if (!coupon) throw new CouponNotFoundException(id);
    return coupon;
  }

  public async createCoupon(input: CreateCouponInput): Promise<CouponDto> {
    if (await this.repository.findByCode(input.code)) throw new ConflictException(`El código ${input.code} ya existe`, "COUPON_CODE_TAKEN");
    return this.repository.create({
      ...input,
      description: input.description ?? null,
      maxDiscountCents: input.maxDiscountCents ?? null,
      usageLimit: input.usageLimit ?? null,
      endsAt: input.endsAt ?? null,
    });
  }

  public async updateCoupon(id: string, input: UpdateCouponInput): Promise<CouponDto> {
    await this.getCouponById(id);
    const changes = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
    return this.repository.update(id, changes);
  }

  // deleteCouponById => "desactivar cupón del catálogo" (no se borra: las órdenes y métricas lo referencian)
  public async deleteCouponById(id: string): Promise<void> {
    await this.getCouponById(id);
    await this.repository.update(id, { isActive: false });
  }

  // validateCoupon => "validar código y calcular descuento aplicable" (respuesta informativa, no lanza)
  public async validateCoupon(code: string, subtotalCents: number, userId: string, lines?: CouponLine[]): Promise<CouponValidationDto> {
    const coupon = await this.repository.findByCode(code.toUpperCase());
    if (!coupon) return { valid: false, code, reason: "INACTIVE", message: "El cupón no existe" };

    // RF-13.2 contexto: nivel del cliente (segmento) y subtotal elegible según categoría/marca de cada producto
    const [redemptions, account, products] = await Promise.all([
      this.repository.countUserRedemptions(coupon.id, userId),
      coupon.segments.length ? prisma.loyaltyAccount.findUnique({ where: { userId }, select: { tier: true } }) : null,
      lines && isScoped(coupon) ? prisma.product.findMany({ where: { id: { in: lines.map((line) => line.productId) } }, select: { id: true, categoryId: true, brandId: true } }) : [],
    ]);
    const facts = new Map(products.map((product) => [product.id, product]));
    const eligible = lines && isScoped(coupon) ? eligibleSubtotal(coupon, lines.map((line) => ({ ...line, categoryId: facts.get(line.productId)?.categoryId ?? null, brandId: facts.get(line.productId)?.brandId ?? null }))) : undefined;
    const result = evaluateCoupon(coupon, subtotalCents, redemptions, new Date(), { userId, tier: account?.tier ?? null, eligibleSubtotalCents: eligible });
    // "result.valid" => discriminante: dentro de cada rama TS conoce los campos disponibles
    return result.valid
      ? { valid: true, couponId: coupon.id, code: coupon.code, discountCents: result.discountCents, freeShipping: result.freeShipping }
      : { valid: false, code: coupon.code, reason: result.reason, message: COUPON_REJECTION_MESSAGES[result.reason] };
  }

  // applyToCheckout => versión estricta para el Checkout: lanza 422 si el cupón no aplica
  public async applyToCheckout(
    code: string,
    subtotalCents: number,
    userId: string,
    lines?: CouponLine[]
  ): Promise<{ couponId: string; discountCents: number; freeShipping: boolean }> {
    const validation = await this.validateCoupon(code, subtotalCents, userId, lines);
    if (!validation.valid) throw new CouponNotApplicableException(validation.message, validation.reason);
    return { couponId: validation.couponId, discountCents: validation.discountCents, freeShipping: validation.freeShipping };
  }
}

// PersonalCouponInput => RF-13.3 / RF-12.4 cupón generado por el sistema para UN cliente
export interface PersonalCouponInput {
  userId: string;
  origin: "WELCOME" | "BIRTHDAY" | "STORE_CREDIT" | "REACTIVATION"; // RF-18.8 cliente inactivo
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number; // Porcentaje o centavos
  validDays: number;
  maxDiscountCents?: number | undefined;
  description: string;
}

// PREFIXES => prefijo legible del código por origen ("BIENVENIDA-7KQ2M9")
const PREFIXES: Record<PersonalCouponInput["origin"], string> = { WELCOME: "BIENVENIDA", BIRTHDAY: "CUMPLE", STORE_CREDIT: "CREDITO", REACTIVATION: "VUELVE" };

// createPersonalCoupon => cupón de un solo uso, solo para ese cliente (userIds), con vigencia desde hoy. Lo usan la
// bienvenida, el cumpleaños y el crédito en tienda de una devolución (DRY)
export async function createPersonalCoupon(input: PersonalCouponInput): Promise<string> {
  const code = `${PREFIXES[input.origin]}-${randomCode(6)}`;
  await couponRepository.create({
    code,
    description: input.description,
    type: input.type,
    value: input.value,
    maxDiscountCents: input.maxDiscountCents ?? null,
    usageLimit: 1,
    usagePerUser: 1,
    startsAt: new Date(),
    endsAt: addDays(new Date(), input.validDays),
    userIds: [input.userId],
    origin: input.origin,
  });
  return code;
}

export const couponService = new CouponService(couponRepository);
