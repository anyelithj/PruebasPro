// cart.service.ts => casos de uso del carrito: obtener activo, agregar, cambiar cantidad, quitar, vaciar.
// Cache-Aside en Redis con TTL: el carrito se lee en cada página (badge del header) y se escribe poco.
import { cartRepository, type CartRepository, type CartRow } from "../repository/cart.repository";
import { cartSubtotal, lineTotal, PrismaStockGateway, type StockGateway } from "../model/cart.model";
import {
  CartItemNotFoundException,
  CurrencyMismatchException,
  InsufficientStockException,
  ProductUnavailableException,
} from "../exception/cart.exception";
import type { CartDto } from "../dto/cart.dto";
import type { AddCartItemInput } from "../schema/cart.schema";
import { prisma } from "../../../config/database.config";
import { appConfig } from "../../../config/app.config";
import { RedisKeys } from "../../../config/redis.config";
import { cached, invalidate } from "../../../shared/interceptor/cache.interceptor";
import { addDays } from "../../../shared/util/date.util";
import { loyaltyService } from "../../loyalty/service/loyalty.service";
import { notificationService } from "../../notification/service/notification.service";
import { logger } from "../../../shared/middleware/logger.middleware";
import { ForbiddenException } from "../../../shared/filter/http-exception.filter";

const CART_CACHE_TTL = 300; // 5 minutos

export class CartService {
  // Dos dependencias inyectadas (DIP): persistencia del carrito y consulta de inventario
  constructor(
    private readonly repository: CartRepository,
    private readonly stock: StockGateway
  ) {}

  // getActiveCart => "obtener carrito activo del usuario autenticado vía JWT"
  public async getActiveCart(userId: string): Promise<CartDto> {
    return cached(RedisKeys.cart(userId), CART_CACHE_TTL, async () => this.toDto(await this.resolveActiveCart(userId)));
  }

  // addItemToCart => "agregar producto al carrito con validación de stock"
  public async addItemToCart(userId: string, input: AddCartItemInput): Promise<CartDto> {
    const cart = await this.resolveActiveCart(userId);
    const availability = (await this.stock.getAvailability([input.variantId])).get(input.variantId);
    if (!availability || !availability.purchasable) throw new ProductUnavailableException();
    await this.assertPreSaleAccess(userId, availability.productId); // RF-14.4
    if (availability.currency !== appConfig.DEFAULT_CURRENCY) throw new CurrencyMismatchException(appConfig.DEFAULT_CURRENCY, availability.currency);

    // Cantidad resultante = lo que ya había en el carrito + lo nuevo; debe caber en el disponible
    const existing = cart.items.find((item) => item.variantId === input.variantId);
    const quantity = (existing?.quantity ?? 0) + input.quantity;
    if (quantity > availability.available) throw new InsufficientStockException(availability.sku, availability.available);

    await this.repository.upsertItem(cart.id, input.variantId, quantity, availability.priceCents);
    return this.afterWrite(userId, cart.id);
  }

  // updateItemQuantity => "cambiar cantidad del ítem — PATCH parcial"
  public async updateItemQuantity(userId: string, itemId: string, quantity: number): Promise<CartDto> {
    const { cart, item } = await this.findOwnedItem(userId, itemId);
    const availability = (await this.stock.getAvailability([item.variantId])).get(item.variantId);
    if (!availability?.purchasable) throw new ProductUnavailableException();
    if (quantity > availability.available) throw new InsufficientStockException(availability.sku, availability.available);

    await this.repository.updateQuantity(itemId, quantity);
    return this.afterWrite(userId, cart.id);
  }

  // removeCartItem => "eliminar ítem específico del carrito"
  public async removeCartItem(userId: string, itemId: string): Promise<CartDto> {
    const { cart } = await this.findOwnedItem(userId, itemId);
    await this.repository.deleteItem(itemId);
    return this.afterWrite(userId, cart.id);
  }

  // deleteAllCarts => "vaciar carrito completo"
  public async clearCart(userId: string): Promise<CartDto> {
    const cart = await this.resolveActiveCart(userId);
    await this.repository.clear(cart.id);
    return this.afterWrite(userId, cart.id);
  }

  // invalidateCache => lo usa el Checkout al convertir el carrito
  public async invalidateCache(userId: string): Promise<void> {
    await invalidate(RedisKeys.cart(userId));
  }

  // assertPreSaleAccess => RF-14.4 producto en preventa (preSaleUntil futuro): solo niveles con ese beneficio
  private async assertPreSaleAccess(userId: string, productId: string): Promise<void> {
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { preSaleUntil: true } });
    if (!product?.preSaleUntil || product.preSaleUntil <= new Date()) return;
    if (!(await loyaltyService.benefitsFor(userId)).preSale) {
      throw new ForbiddenException(`Preventa exclusiva para los niveles Diamante y Platino hasta el ${product.preSaleUntil.toISOString().slice(0, 10)}`);
    }
  }

  // remindAbandoned => RF-07.6 job periódico: avisa (app, email y push según preferencias) a quien dejó productos en su
  // carrito sin actividad por ABANDONED_CART_HOURS. Un recordatorio por inactividad: se marca remindedAt
  public async remindAbandoned(batchSize = 100): Promise<number> {
    const carts = await this.repository.findAbandoned(new Date(Date.now() - appConfig.ABANDONED_CART_HOURS * 3_600_000), batchSize);
    for (const cart of carts) {
      await notificationService.notify(cart.userId, { type: "PROMOTION", message: { key: "cartAbandoned", params: { itemCount: cart.itemCount } }, url: "/cart" });
      await this.repository.markReminded(cart.id);
    }
    if (carts.length > 0) logger.info("abandoned_carts_reminded", { count: carts.length });
    return carts.length;
  }

  // activeCartUserIds => RF-07.5 quiénes tienen el producto en el carrito (lo usa el módulo de notificaciones)
  public activeCartUserIds(productId: string): Promise<string[]> {
    return this.repository.activeCartUserIds(productId);
  }

  // resolveActiveCart => devuelve el carrito ACTIVE vigente; si venció lo marca ABANDONED y crea uno nuevo
  private async resolveActiveCart(userId: string): Promise<CartRow> {
    const cart = await this.repository.findActive(userId);
    if (cart && cart.expiresAt > new Date()) return cart;
    if (cart) await this.repository.markAbandoned(cart.id);
    return this.repository.create(userId, addDays(new Date(), appConfig.CART_TTL_DAYS));
  }

  // findOwnedItem => el ítem debe pertenecer al carrito activo del usuario (ownership, sin revelar ítems ajenos)
  private async findOwnedItem(userId: string, itemId: string) {
    const cart = await this.resolveActiveCart(userId);
    const item = cart.items.find((line) => line.id === itemId);
    if (!item) throw new CartItemNotFoundException(itemId);
    return { cart, item };
  }

  // afterWrite => extiende la vigencia, invalida la cache y devuelve el estado fresco
  private async afterWrite(userId: string, cartId: string): Promise<CartDto> {
    await this.repository.touch(cartId, addDays(new Date(), appConfig.CART_TTL_DAYS));
    await this.invalidateCache(userId);
    return this.getActiveCart(userId);
  }

  // toDto => enriquece cada línea con datos vivos del catálogo (precio actual, disponibilidad)
  private async toDto(cart: CartRow): Promise<CartDto> {
    const availability = await this.stock.getAvailability(cart.items.map((item) => item.variantId));
    const items = cart.items.flatMap((item) => {
      const info = availability.get(item.variantId);
      if (!info) return []; // Variante eliminada del catálogo: la línea se omite ("flatMap" con [] = filtrar)
      const current = { unitPriceCents: info.priceCents, quantity: item.quantity };
      return [
        {
          id: item.id,
          variantId: item.variantId,
          productId: info.productId,
          productName: info.productName,
          productSlug: info.productSlug,
          variantName: info.variantName,
          sku: info.sku,
          imageUrl: info.imageUrl,
          unitPriceCents: info.priceCents,
          quantity: item.quantity,
          lineTotalCents: lineTotal(current),
          available: info.available,
          priceChanged: info.priceCents !== item.unitPriceCents,
          previousUnitPriceCents: info.priceCents !== item.unitPriceCents ? item.unitPriceCents : null,
          priceDropped: info.priceCents < item.unitPriceCents,
          lowStock: info.available > 0 && info.available <= appConfig.LOW_STOCK_THRESHOLD,
          purchasable: info.purchasable && info.available >= item.quantity,
        },
      ];
    });
    const subtotalCents = cartSubtotal(items);
    return {
      id: cart.id,
      currency: appConfig.DEFAULT_CURRENCY,
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotalCents,
      expiresAt: cart.expiresAt,
      loyalty: await loyaltyService.redemptionFor(cart.userId, subtotalCents), // RF-07.3 vista previa del canje
    };
  }
}

// Composición de dependencias (Composition Root del módulo): hoy el inventario lo resuelve PostgreSQL
export const cartService = new CartService(cartRepository, new PrismaStockGateway(prisma));
