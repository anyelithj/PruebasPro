// notification.event.ts => SUSCRIPTORES que traducen eventos de dominio en notificaciones y correos (patrón Observer).
// Cada notificación se publica como CLAVE + PARÁMETROS (messages.constants): el texto se redacta en el idioma del
// destinatario (emails/push) o de quien consulta la bandeja, nunca queda fijo en español.
// Agregar una notificación nueva = una clave en el diccionario + un suscriptor aquí (OCP + bajo acoplamiento).
// Se registra UNA vez en el bootstrap.
import { authEvents } from "../../auth/service/auth.service";
import { commerceEvents } from "../../order/event/order.event";
import { notificationService } from "../service/notification.service";
import { emailService } from "../../email/service/email.service";
import { EmailTemplates } from "../../email/util/template.util";
import { smsProvider } from "../provider/sms.provider"; // RF-01.1: transporte SMS (Twilio o log en desarrollo)
import { MESSAGES } from "../../../shared/constants/messages.constants";
import { inventoryEvents } from "../../inventory/event/inventory.event";
import { productRepository } from "../../product/repository/product.repository";
import type { NotifyInput } from "../dto/notification.dto";
import { redis } from "../../../config/redis.config";
import { cartService } from "../../cart/service/cart.service";

const WISHLIST_ALERT_TTL_SECONDS = 24 * 60 * 60; // Un aviso del mismo tipo por producto cada 24 h (sin spam)

// notifyWishlist => RF-02.7 avisa a quienes guardaron el producto en su lista de deseos. Deduplicado en Redis con
// SET NX EX (un ajuste de stock repetido no dispara avisos repetidos); si Redis no responde, se avisa igual
async function notifyWishlist(productId: string, kind: "stock" | "price", input: NotifyInput): Promise<void> {
  const first = await redis.set(`wishlist:alert:${kind}:${productId}`, "1", "EX", WISHLIST_ALERT_TTL_SECONDS, "NX").catch(() => "OK");
  if (first !== "OK") return;
  const userIds = await productRepository.wishlistUserIds(productId);
  if (userIds.length > 0) await notificationService.broadcast(userIds, input);
}

// notifyCartHolders => RF-07.5 mismo esquema (deduplicado 24 h por producto) para quienes lo tienen en el carrito
async function notifyCartHolders(productId: string, kind: "price" | "low", input: NotifyInput): Promise<void> {
  const first = await redis.set(`cart:alert:${kind}:${productId}`, "1", "EX", WISHLIST_ALERT_TTL_SECONDS, "NX").catch(() => "OK");
  if (first !== "OK") return;
  const userIds = await cartService.activeCartUserIds(productId);
  if (userIds.length > 0) await notificationService.broadcast(userIds, input);
}

export function registerNotificationSubscribers(): void {
  // --- Identidad: correos transaccionales directos (no dependen de preferencias: son obligatorios) ---
  // "event.locale" => idioma preferido del usuario (users.locale)
  authEvents.on("user.registered", (event) =>
    emailService.send(event.email, EmailTemplates.verifyEmail(event.locale, { firstName: event.firstName, userId: event.userId, token: event.verificationToken }))
  );
  authEvents.on("user.password-reset-requested", (event) =>
    emailService.send(event.email, EmailTemplates.passwordReset(event.locale, { firstName: event.firstName, token: event.resetToken }))
  );
  authEvents.on("user.two-factor-code", (event) =>
    emailService.send(event.email, EmailTemplates.twoFactorCode(event.locale, { firstName: event.firstName, code: event.code }))
  );
  // RF-01.5 bienvenida, RF-01.3 enlace mágico y RF-01.1 código SMS del teléfono
  authEvents.on("user.welcome", (event) => emailService.send(event.email, EmailTemplates.welcome(event.locale, { firstName: event.firstName })));
  authEvents.on("user.magic-link-requested", (event) =>
    emailService.send(event.email, EmailTemplates.magicLink(event.locale, { firstName: event.firstName, token: event.token }))
  );
  authEvents.on("user.phone-code", (event) => smsProvider.send(event.phone, MESSAGES[event.locale].sms.phoneCode(event.code)));
  authEvents.on("user.password-changed", (event) =>
    notificationService.notify(event.userId, { type: "SECURITY", message: { key: "passwordChanged", params: {} }, url: "/account" })
  );

  // --- Lista de deseos (RF-02.7) y carrito (RF-07.5): bajada de precio y producto de nuevo disponible ---
  commerceEvents.on("product.price-dropped", async (event) => {
    const input: NotifyInput = {
      type: "PROMOTION",
      message: { key: "wishlistPriceDrop", params: { productName: event.productName, oldCents: event.oldCents, newCents: event.newCents, currency: event.currency } },
      url: `/products/${event.slug}`,
    };
    // "Promise.all" => lista de deseos y carritos se avisan en paralelo (mismo texto: el producto bajó de precio)
    await Promise.all([notifyWishlist(event.productId, "price", input), notifyCartHolders(event.productId, "price", { ...input, url: "/cart" })]);
  });
  // RF-07.5 poco stock: quienes lo tienen en el carrito reciben "¡quedan N!" (urgencia real, no inventada)
  inventoryEvents.on("inventory.low", (level) =>
    level.available > 0
      ? notifyCartHolders(level.productId, "low", { type: "PROMOTION", message: { key: "cartLowStock", params: { productName: level.productName, available: level.available } }, url: "/cart" })
      : undefined
  );
  const backInStock = (productId: string, productName: string, slug?: string) =>
    notifyWishlist(productId, "stock", { type: "PROMOTION", message: { key: "wishlistBackInStock", params: { productName } }, url: slug ? `/products/${slug}` : "/account/wishlist" });
  commerceEvents.on("product.back-in-stock", (event) => backInStock(event.productId, event.productName, event.slug));
  // Entrada de inventario que lleva una variante de 0 a disponible (compra a proveedor, devolución, ajuste)
  inventoryEvents.on("inventory.adjusted", (level) => (level.delta > 0 && level.available > 0 && level.available - level.delta <= 0 ? backInStock(level.productId, level.productName) : undefined));

  // --- Comercio ---
  commerceEvents.on("order.placed", (event) =>
    notificationService.notify(event.userId, {
      type: "ORDER",
      message: { key: "orderPlaced", params: { orderNumber: event.orderNumber, totalCents: event.totalCents, currency: event.currency } },
      url: `/account/orders/${event.orderId}`,
      data: { orderId: event.orderId },
    })
  );
  commerceEvents.on("order.status-changed", (event) =>
    notificationService.notify(event.userId, {
      type: "ORDER",
      message: { key: "orderStatus", params: { orderNumber: event.orderNumber, status: event.to } },
      url: `/account/orders/${event.orderId}`,
      // Los pasos internos de bodega solo se muestran en la app; envío/entrega también por email y push
      channels: event.to === "SHIPPED" || event.to === "DELIVERED" ? undefined : ["IN_APP"],
    })
  );
  commerceEvents.on("order.cancelled", (event) =>
    notificationService.notify(event.userId, {
      type: "ORDER",
      message: { key: "orderCancelled", params: { orderNumber: event.orderNumber, reason: event.reason } },
      url: `/account/orders/${event.orderId}`,
    })
  );
  commerceEvents.on("payment.failed", (event) =>
    notificationService.notify(event.userId, {
      type: "PAYMENT",
      message: { key: "paymentFailed", params: { reason: event.reason } },
      url: `/checkout/${event.checkoutSessionId}/payment`,
    })
  );
  commerceEvents.on("shipment.updated", (event) =>
    notificationService.notify(event.userId, {
      type: "SHIPPING",
      message: { key: "shipmentUpdated", params: { orderNumber: event.orderNumber, status: event.status, trackingNumber: event.trackingNumber ?? null } },
      url: `/account/orders/${event.orderId}`,
    })
  );
  commerceEvents.on("refund.updated", (event) =>
    notificationService.notify(event.userId, {
      type: "REFUND",
      message: { key: "refundUpdated", params: { amountCents: event.amountCents, currency: event.currency, status: event.status } },
      url: `/account/orders/${event.orderId}`,
    })
  );
  commerceEvents.on("invoice.issued", (event) =>
    notificationService.notify(event.userId, {
      type: "ORDER",
      message: { key: "invoiceIssued", params: { number: event.number } },
      url: `/account/orders/${event.orderId}`,
      channels: ["IN_APP"],
    })
  );
  commerceEvents.on("loyalty.tier-upgraded", (event) =>
    notificationService.notify(event.userId, { type: "LOYALTY", message: { key: "tierUpgraded", params: { tier: event.tier } }, url: "/account/loyalty" })
  );
  commerceEvents.on("loyalty.badge-minted", (event) =>
    notificationService.notify(event.userId, { type: "LOYALTY", message: { key: "badgeMinted", params: { tier: event.tier, txHash: event.txHash } }, url: "/account/loyalty" })
  );
  commerceEvents.on("review.moderated", (event) =>
    notificationService.notify(event.userId, { type: "REVIEW", message: { key: "reviewModerated", params: { approved: event.approved } }, url: "/account/reviews" })
  );
  commerceEvents.on("review.replied", (event) =>
    notificationService.notify(event.userId, { type: "REVIEW", message: { key: "reviewReplied", params: {} }, url: "/account/reviews" })
  );
}
