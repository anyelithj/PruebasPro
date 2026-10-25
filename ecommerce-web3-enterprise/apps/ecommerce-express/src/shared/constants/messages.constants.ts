// messages.constants.ts => textos que GENERA el backend (notificaciones, emails, conceptos de puntos) en es/en.
// Tipado estricto: cada clave declara sus parámetros y el tipo "Dictionary" obliga a que AMBOS idiomas definan
// exactamente las mismas claves con las mismas firmas (si falta una traducción, no compila).
// Paradigma funcional: cada mensaje es una función pura (parámetros -> texto).
import type { LoyaltyTier, OrderStatus, RefundStatus, ShipmentStatus } from "@prisma/client";
import { formatMoney, type Locale } from "../util/i18n.util";

type NoParams = Record<string, never>;

// NotificationParams => clave de notificación -> forma de sus parámetros (se guardan en MongoDB junto a la clave)
export interface NotificationParams {
  passwordChanged: NoParams;
  orderPlaced: { orderNumber: string; totalCents: number; currency: string };
  orderStatus: { orderNumber: string; status: OrderStatus };
  orderCancelled: { orderNumber: string; reason: string };
  paymentFailed: { reason: string };
  shipmentUpdated: { orderNumber: string; status: ShipmentStatus; trackingNumber: string | null };
  refundUpdated: { amountCents: number; currency: string; status: RefundStatus };
  invoiceIssued: { number: string };
  tierUpgraded: { tier: LoyaltyTier };
  badgeMinted: { tier: LoyaltyTier; txHash: string };
  reviewModerated: { approved: boolean };
  reviewReplied: NoParams;
  // RF-02.7: avisos de la lista de deseos (el producto volvió a tener stock / bajó de precio)
  wishlistBackInStock: { productName: string };
  wishlistPriceDrop: { productName: string; oldCents: number; newCents: number; currency: string };
  // RF-07.5 poco stock de un producto del carrito; RF-07.6 carrito abandonado; RF-09.6 envío retrasado
  cartLowStock: { productName: string; available: number };
  cartAbandoned: { itemCount: number };
  shipmentDelayed: { orderNumber: string };
  // RF-14.7 puntos ganados / por vencer; RF-14.9 logro; RF-13.3 cupón automático; RF-15.8 pedir reseña; RF-12.8 recolección
  pointsEarned: { points: number; reason: string };
  pointsExpiring: { points: number; days: number };
  achievementUnlocked: { code: AchievementCode };
  couponGranted: { code: string; origin: "WELCOME" | "BIRTHDAY" | "STORE_CREDIT" };
  reviewRequest: { orderNumber: string };
  returnPickupScheduled: { orderNumber: string; date: string; trackingNumber: string };
  personalShopperRequest: { name: string; message: string }; // RF-14.4 aviso al equipo
  personalizedOffer: { productName: string; percent: number }; // RF-16.3 oferta según el historial del cliente
  customerReactivation: { firstName: string; code: string; percent: number }; // RF-18.8 / RF-20.8 cliente inactivo
}

// AchievementCode => RF-14.9 logros disponibles (la regla de cada uno vive en loyalty.model.ts)
export const ACHIEVEMENT_CODES = ["FIRST_ORDER", "FIVE_ORDERS", "TEN_ORDERS", "FIRST_REVIEW", "PHOTO_REVIEWER", "FIRST_REFERRAL", "SOCIAL_SHARER", "GOLD_MEMBER"] as const;
export type AchievementCode = (typeof ACHIEVEMENT_CODES)[number];
export type NotificationKey = keyof NotificationParams;
export const NOTIFICATION_KEYS = [
  "passwordChanged", "orderPlaced", "orderStatus", "orderCancelled", "paymentFailed", "shipmentUpdated",
  "refundUpdated", "invoiceIssued", "tierUpgraded", "badgeMinted", "reviewModerated", "reviewReplied",
  "wishlistBackInStock", "wishlistPriceDrop", "cartLowStock", "cartAbandoned", "shipmentDelayed",
  "pointsEarned", "pointsExpiring", "achievementUnlocked", "couponGranted", "reviewRequest", "returnPickupScheduled", "personalShopperRequest", "personalizedOffer", "customerReactivation",
] as const satisfies readonly NotificationKey[];

// LoyaltyReasonParams => concepto de un movimiento de puntos generado por el sistema
export interface LoyaltyReasonParams {
  PURCHASE: { orderNumber: string };
  REFUND_ADJUSTMENT: NoParams;
  EXPIRATION: NoParams;
  REDEMPTION: { orderNumber: string }; // RF-07.3 / RF-08.7 puntos canjeados como descuento en un pedido
  // RF-14.1 puntos por acciones y RF-14.9 logros
  SIGNUP: NoParams;
  REVIEW_PHOTO: NoParams;
  SOCIAL_SHARE: { network: string };
  REFERRAL: { friend: string };
  BIRTHDAY: NoParams;
  ACHIEVEMENT: { code: AchievementCode };
}
export type LoyaltyReasonCode = keyof LoyaltyReasonParams;
export const LOYALTY_REASON_CODES = ["PURCHASE", "REFUND_ADJUSTMENT", "EXPIRATION", "REDEMPTION", "SIGNUP", "REVIEW_PHOTO", "SOCIAL_SHARE", "REFERRAL", "BIRTHDAY", "ACHIEVEMENT"] as const satisfies readonly LoyaltyReasonCode[];
// LoyaltyReason => unión distributiva { code, params } correlacionados, o texto libre escrito por un administrador
export type LoyaltyReason = string | { [K in LoyaltyReasonCode]: { code: K; params: LoyaltyReasonParams[K] } }[LoyaltyReasonCode];

export interface RenderedNotification {
  title: string;
  body: string;
}

// Dictionary => contrato que cumple cada idioma ("mapped types": una función por clave con SUS parámetros)
interface Dictionary {
  notifications: { [K in NotificationKey]: (params: NotificationParams[K]) => RenderedNotification };
  loyaltyReasons: { [K in LoyaltyReasonCode]: (params: LoyaltyReasonParams[K]) => string };
  tiers: Record<LoyaltyTier, string>;
  achievements: Record<AchievementCode, string>; // RF-14.9 nombre visible de cada logro
  email: {
    footer: string;
    linkFallback: string;
    viewDetail: string;
    verify: { subject: string; heading: (name: string) => string; body: string; cta: string; text: (name: string, url: string) => string };
    reset: { subject: string; heading: (name: string) => string; body: string; cta: string; text: (url: string) => string };
    passwordChanged: { subject: string; heading: (name: string) => string; body: string; text: string };
    twoFactor: { subject: (code: string) => string; heading: (name: string) => string; expires: string; text: (code: string) => string };
    welcome: { subject: string; heading: (name: string) => string; body: string; cta: string; text: (name: string, url: string) => string }; // RF-01.5
    magicLink: { subject: string; heading: (name: string) => string; body: string; cta: string; text: (url: string) => string }; // RF-01.3
  };
  sms: { phoneCode: (code: string) => string }; // RF-01.1 (texto corto: un SMS = 160 caracteres)
}

// --- Español (por defecto) ---
const ORDER_ES: Record<OrderStatus, string> = { CONFIRMED: "fue confirmado", PREPARING: "se está preparando", PACKED: "está empacado y listo para despacho", SHIPPED: "fue enviado", DELIVERED: "fue entregado", CANCELLED: "fue cancelado" };
const SHIPMENT_ES: Record<ShipmentStatus, string> = { PENDING: "está pendiente de despacho", LABEL_CREATED: "tiene guía generada", IN_TRANSIT: "va en camino", OUT_FOR_DELIVERY: "está en reparto", DELIVERED: "fue entregado", CANCELLED: "fue cancelado", RETURNED: "fue devuelto" };
const REFUND_ES: Record<RefundStatus, string> = { REQUESTED: "fue recibida y está en revisión", APPROVED: "fue aprobada", REJECTED: "fue rechazada", PROCESSED: "fue procesada: el dinero va en camino a tu medio de pago", CANCELLED: "fue cancelada" };
const TIERS_ES: Record<LoyaltyTier, string> = { BRONZE: "Bronce", SILVER: "Plata", GOLD: "Oro", DIAMOND: "Diamante", PLATINUM: "Platino" };
const ACHIEVEMENTS_ES: Record<AchievementCode, string> = {
  FIRST_ORDER: "Primera compra", FIVE_ORDERS: "Cliente frecuente (5 compras)", TEN_ORDERS: "Fan de la tienda (10 compras)", FIRST_REVIEW: "Primera reseña",
  PHOTO_REVIEWER: "Reseña con fotos", FIRST_REFERRAL: "Embajador: primer amigo referido", SOCIAL_SHARER: "Influencer: compartiste en redes", GOLD_MEMBER: "Miembro Oro",
};

const es: Dictionary = {
  notifications: {
    passwordChanged: () => ({ title: "Tu contraseña fue cambiada", body: "Si no fuiste tú, restablece tu contraseña de inmediato." }),
    orderPlaced: (p) => ({ title: `Pedido ${p.orderNumber} confirmado`, body: `Recibimos tu pago de ${formatMoney(p.totalCents, p.currency, "es")}. Te avisaremos cuando salga.` }),
    orderStatus: (p) => ({ title: `Pedido ${p.orderNumber}`, body: `Tu pedido ${ORDER_ES[p.status]}.` }),
    orderCancelled: (p) => ({ title: `Pedido ${p.orderNumber} cancelado`, body: `Motivo: ${p.reason}. Si ya pagaste, el reembolso se procesa automáticamente.` }),
    paymentFailed: (p) => ({ title: "No pudimos procesar tu pago", body: `${p.reason}. Puedes intentarlo de nuevo con otro medio de pago.` }),
    shipmentUpdated: (p) => ({ title: `Envío del pedido ${p.orderNumber}`, body: `Tu envío ${SHIPMENT_ES[p.status]}${p.trackingNumber ? ` (guía ${p.trackingNumber})` : ""}.` }),
    refundUpdated: (p) => ({ title: "Actualización de tu devolución", body: `Tu solicitud por ${formatMoney(p.amountCents, p.currency, "es")} ${REFUND_ES[p.status]}.` }),
    invoiceIssued: (p) => ({ title: `Factura ${p.number} disponible`, body: "Tu factura electrónica fue emitida. Puedes descargarla desde el detalle del pedido." }),
    tierUpgraded: (p) => ({ title: `¡Subiste a nivel ${TIERS_ES[p.tier]}!`, body: "Desbloqueaste una insignia NFT coleccionable. Vincula tu wallet para recibirla." }),
    badgeMinted: (p) => ({ title: `Tu insignia ${TIERS_ES[p.tier]} ya está en tu wallet`, body: `Transacción ${p.txHash.slice(0, 10)}… confirmada en la blockchain.` }),
    reviewModerated: (p) => (p.approved ? { title: "Tu reseña fue publicada", body: "Gracias por ayudar a otros compradores." } : { title: "Tu reseña no fue publicada", body: "No cumple las normas de la comunidad." }),
    reviewReplied: () => ({ title: "El vendedor respondió tu reseña", body: "Revisa la respuesta en tu cuenta." }),
    wishlistBackInStock: (p) => ({ title: `¡${p.productName} volvió!`, body: "Un producto de tu lista de deseos ya tiene unidades disponibles." }),
    wishlistPriceDrop: (p) => ({ title: `${p.productName} bajó de precio`, body: `Antes ${formatMoney(p.oldCents, p.currency, "es")}, ahora ${formatMoney(p.newCents, p.currency, "es")}.` }),
    cartLowStock: (p) => ({ title: `¡Quedan ${p.available} de ${p.productName}!`, body: "Está en tu carrito y se está agotando. Finaliza tu compra para asegurarlo." }),
    pointsEarned: (p) => ({ title: `¡Ganaste ${p.points} puntos!`, body: p.reason }),
    pointsExpiring: (p) => ({ title: `${p.points} puntos vencen pronto`, body: `Vencen en ${p.days} días. Úsalos como descuento en tu próxima compra.` }),
    achievementUnlocked: (p) => ({ title: "¡Logro desbloqueado!", body: ACHIEVEMENTS_ES[p.code] }),
    couponGranted: (p) => ({ title: p.origin === "BIRTHDAY" ? "¡Feliz cumpleaños! Tienes un regalo" : p.origin === "WELCOME" ? "Tu cupón de bienvenida" : "Tienes crédito en la tienda", body: `Usa el código ${p.code} en tu próxima compra.` }),
    reviewRequest: (p) => ({ title: "¿Qué te pareció tu compra?", body: `Cuéntanos sobre tu pedido ${p.orderNumber}: tu reseña ayuda a otros y te da puntos.` }),
    returnPickupScheduled: (p) => ({ title: `Recolección de tu devolución (${p.orderNumber})`, body: `La transportadora pasará el ${p.date}. Guía ${p.trackingNumber}: imprime la etiqueta desde tu cuenta.` }),
    personalShopperRequest: (p) => ({ title: `Personal shopper: ${p.name}`, body: p.message }),
    personalizedOffer: (p) => ({ title: `Elegido para ti: ${p.productName}`, body: `Está con ${p.percent}% de descuento por tiempo limitado.` }),
    customerReactivation: (p) => ({ title: `${p.firstName}, ¡te extrañamos!`, body: `Vuelve con ${p.percent}% de descuento usando el código ${p.code}.` }),
    cartAbandoned: (p) => ({ title: "Tu carrito te espera", body: `Dejaste ${p.itemCount} ${p.itemCount === 1 ? "producto" : "productos"} en tu carrito. Lo guardamos para ti.` }),
    shipmentDelayed: (p) => ({ title: `Tu pedido ${p.orderNumber} viene con retraso`, body: "La transportadora no ha entregado en la fecha estimada. Ya estamos haciendo seguimiento." }),
  },
  loyaltyReasons: {
    PURCHASE: (p) => `Compra ${p.orderNumber}`,
    REFUND_ADJUSTMENT: () => "Ajuste por devolución",
    EXPIRATION: () => "Vencimiento de puntos",
    REDEMPTION: (p) => `Canje en el pedido ${p.orderNumber}`,
    SIGNUP: () => "Bienvenida: registro en la tienda",
    REVIEW_PHOTO: () => "Reseña con fotos",
    SOCIAL_SHARE: (p) => `Compartiste un producto en ${p.network}`,
    REFERRAL: (p) => `Referiste a ${p.friend}`,
    BIRTHDAY: () => "Regalo de cumpleaños",
    ACHIEVEMENT: (p) => `Logro: ${ACHIEVEMENTS_ES[p.code]}`,
  },
  tiers: TIERS_ES,
  achievements: ACHIEVEMENTS_ES,
  email: {
    footer: "eCommerce Web3 · Este es un mensaje automático, no respondas a este correo.",
    linkFallback: "Si el botón no funciona, copia este enlace:",
    viewDetail: "Ver detalle",
    verify: {
      subject: "Verifica tu cuenta",
      heading: (name) => `Hola ${name}, confirma tu email`,
      body: "Gracias por registrarte. Confirma tu dirección de correo para activar la cuenta. El enlace vence en 24 horas.",
      cta: "Verificar mi cuenta",
      text: (name, url) => `Hola ${name}, verifica tu cuenta en: ${url} (vence en 24 horas).`,
    },
    reset: {
      subject: "Restablece tu contraseña",
      heading: (name) => `Hola ${name}`,
      body: "Recibimos una solicitud para restablecer tu contraseña. El enlace vence en 1 hora. Si no fuiste tú, ignora este mensaje.",
      cta: "Crear nueva contraseña",
      text: (url) => `Restablece tu contraseña en: ${url} (vence en 1 hora). Si no fuiste tú, ignora este mensaje.`,
    },
    passwordChanged: {
      subject: "Tu contraseña fue cambiada",
      heading: (name) => `Hola ${name}`,
      body: "Tu contraseña se cambió correctamente y cerramos las demás sesiones. Si no fuiste tú, restablécela de inmediato.",
      text: "Tu contraseña fue cambiada. Si no fuiste tú, restablécela de inmediato.",
    },
    twoFactor: {
      subject: (code) => `Tu código de acceso: ${code}`,
      heading: (name) => `Hola ${name}, este es tu código`,
      expires: "Vence en 10 minutos. Nunca lo compartas.",
      text: (code) => `Tu código de acceso es ${code}. Vence en 10 minutos.`,
    },
    welcome: {
      subject: "¡Bienvenido a eCommerce Web3!",
      heading: (name) => `Hola ${name}, tu cuenta está lista`,
      body: "Ya puedes comprar, guardar favoritos, acumular puntos de fidelidad y conectar tu wallet para recibir insignias NFT.",
      cta: "Ir a la tienda",
      text: (name, url) => `Hola ${name}, tu cuenta está lista. Visita la tienda: ${url}`,
    },
    magicLink: {
      subject: "Tu enlace para entrar",
      heading: (name) => `Hola ${name}`,
      body: "Usa este enlace para entrar sin contraseña. Vence en 15 minutos y solo funciona una vez. Si no lo pediste, ignora este mensaje.",
      cta: "Entrar a mi cuenta",
      text: (url) => `Entra a tu cuenta con este enlace (vence en 15 minutos): ${url}`,
    },
  },
  sms: { phoneCode: (code) => `eCommerce Web3: tu código de verificación es ${code}. Vence en 10 min.` },
};

// --- Inglés ---
const ORDER_EN: Record<OrderStatus, string> = { CONFIRMED: "was confirmed", PREPARING: "is being prepared", PACKED: "is packed and ready to ship", SHIPPED: "has shipped", DELIVERED: "was delivered", CANCELLED: "was cancelled" };
const SHIPMENT_EN: Record<ShipmentStatus, string> = { PENDING: "is waiting to be dispatched", LABEL_CREATED: "has a shipping label", IN_TRANSIT: "is on its way", OUT_FOR_DELIVERY: "is out for delivery", DELIVERED: "was delivered", CANCELLED: "was cancelled", RETURNED: "was returned" };
const REFUND_EN: Record<RefundStatus, string> = { REQUESTED: "was received and is under review", APPROVED: "was approved", REJECTED: "was rejected", PROCESSED: "was processed: the money is on its way to your payment method", CANCELLED: "was cancelled" };
const TIERS_EN: Record<LoyaltyTier, string> = { BRONZE: "Bronze", SILVER: "Silver", GOLD: "Gold", DIAMOND: "Diamond", PLATINUM: "Platinum" };
const ACHIEVEMENTS_EN: Record<AchievementCode, string> = {
  FIRST_ORDER: "First purchase", FIVE_ORDERS: "Regular customer (5 orders)", TEN_ORDERS: "Store fan (10 orders)", FIRST_REVIEW: "First review",
  PHOTO_REVIEWER: "Review with photos", FIRST_REFERRAL: "Ambassador: first referred friend", SOCIAL_SHARER: "Influencer: shared on social media", GOLD_MEMBER: "Gold member",
};

const en: Dictionary = {
  notifications: {
    passwordChanged: () => ({ title: "Your password was changed", body: "If this wasn't you, reset your password right away." }),
    orderPlaced: (p) => ({ title: `Order ${p.orderNumber} confirmed`, body: `We received your payment of ${formatMoney(p.totalCents, p.currency, "en")}. We'll let you know when it ships.` }),
    orderStatus: (p) => ({ title: `Order ${p.orderNumber}`, body: `Your order ${ORDER_EN[p.status]}.` }),
    orderCancelled: (p) => ({ title: `Order ${p.orderNumber} cancelled`, body: `Reason: ${p.reason}. If you already paid, the refund is processed automatically.` }),
    paymentFailed: (p) => ({ title: "We couldn't process your payment", body: `${p.reason}. You can try again with another payment method.` }),
    shipmentUpdated: (p) => ({ title: `Shipment for order ${p.orderNumber}`, body: `Your shipment ${SHIPMENT_EN[p.status]}${p.trackingNumber ? ` (tracking ${p.trackingNumber})` : ""}.` }),
    refundUpdated: (p) => ({ title: "Update on your return", body: `Your request for ${formatMoney(p.amountCents, p.currency, "en")} ${REFUND_EN[p.status]}.` }),
    invoiceIssued: (p) => ({ title: `Invoice ${p.number} available`, body: "Your electronic invoice was issued. You can download it from the order details." }),
    tierUpgraded: (p) => ({ title: `You reached the ${TIERS_EN[p.tier]} tier!`, body: "You unlocked a collectible NFT badge. Link your wallet to receive it." }),
    badgeMinted: (p) => ({ title: `Your ${TIERS_EN[p.tier]} badge is in your wallet`, body: `Transaction ${p.txHash.slice(0, 10)}… confirmed on the blockchain.` }),
    reviewModerated: (p) => (p.approved ? { title: "Your review was published", body: "Thanks for helping other shoppers." } : { title: "Your review was not published", body: "It doesn't meet the community guidelines." }),
    reviewReplied: () => ({ title: "The seller replied to your review", body: "Check the reply in your account." }),
    wishlistBackInStock: (p) => ({ title: `${p.productName} is back!`, body: "An item on your wishlist is available again." }),
    wishlistPriceDrop: (p) => ({ title: `${p.productName} dropped in price`, body: `Was ${formatMoney(p.oldCents, p.currency, "en")}, now ${formatMoney(p.newCents, p.currency, "en")}.` }),
    cartLowStock: (p) => ({ title: `Only ${p.available} left of ${p.productName}!`, body: "It's in your cart and selling out. Check out now to secure it." }),
    pointsEarned: (p) => ({ title: `You earned ${p.points} points!`, body: p.reason }),
    pointsExpiring: (p) => ({ title: `${p.points} points expire soon`, body: `They expire in ${p.days} days. Use them as a discount on your next order.` }),
    achievementUnlocked: (p) => ({ title: "Achievement unlocked!", body: ACHIEVEMENTS_EN[p.code] }),
    couponGranted: (p) => ({ title: p.origin === "BIRTHDAY" ? "Happy birthday! A gift for you" : p.origin === "WELCOME" ? "Your welcome coupon" : "You have store credit", body: `Use code ${p.code} on your next order.` }),
    reviewRequest: (p) => ({ title: "How was your purchase?", body: `Tell us about order ${p.orderNumber}: your review helps others and earns you points.` }),
    returnPickupScheduled: (p) => ({ title: `Return pickup (${p.orderNumber})`, body: `The carrier will come on ${p.date}. Tracking ${p.trackingNumber}: print the label from your account.` }),
    personalShopperRequest: (p) => ({ title: `Personal shopper: ${p.name}`, body: p.message }),
    personalizedOffer: (p) => ({ title: `Picked for you: ${p.productName}`, body: `Now ${p.percent}% off for a limited time.` }),
    customerReactivation: (p) => ({ title: `${p.firstName}, we miss you!`, body: `Come back with ${p.percent}% off using code ${p.code}.` }),
    cartAbandoned: (p) => ({ title: "Your cart is waiting", body: `You left ${p.itemCount} ${p.itemCount === 1 ? "item" : "items"} in your cart. We saved it for you.` }),
    shipmentDelayed: (p) => ({ title: `Your order ${p.orderNumber} is delayed`, body: "The carrier missed the estimated delivery date. We are already following up." }),
  },
  loyaltyReasons: {
    PURCHASE: (p) => `Purchase ${p.orderNumber}`,
    REFUND_ADJUSTMENT: () => "Return adjustment",
    EXPIRATION: () => "Points expiration",
    REDEMPTION: (p) => `Redeemed on order ${p.orderNumber}`,
    SIGNUP: () => "Welcome: store sign-up",
    REVIEW_PHOTO: () => "Review with photos",
    SOCIAL_SHARE: (p) => `You shared a product on ${p.network}`,
    REFERRAL: (p) => `You referred ${p.friend}`,
    BIRTHDAY: () => "Birthday gift",
    ACHIEVEMENT: (p) => `Achievement: ${ACHIEVEMENTS_EN[p.code]}`,
  },
  tiers: TIERS_EN,
  achievements: ACHIEVEMENTS_EN,
  email: {
    footer: "eCommerce Web3 · This is an automated message, please don't reply to this email.",
    linkFallback: "If the button doesn't work, copy this link:",
    viewDetail: "View details",
    verify: {
      subject: "Verify your account",
      heading: (name) => `Hi ${name}, confirm your email`,
      body: "Thanks for signing up. Confirm your email address to activate your account. The link expires in 24 hours.",
      cta: "Verify my account",
      text: (name, url) => `Hi ${name}, verify your account at: ${url} (expires in 24 hours).`,
    },
    reset: {
      subject: "Reset your password",
      heading: (name) => `Hi ${name}`,
      body: "We received a request to reset your password. The link expires in 1 hour. If this wasn't you, ignore this message.",
      cta: "Create a new password",
      text: (url) => `Reset your password at: ${url} (expires in 1 hour). If this wasn't you, ignore this message.`,
    },
    passwordChanged: {
      subject: "Your password was changed",
      heading: (name) => `Hi ${name}`,
      body: "Your password was changed successfully and we signed out your other sessions. If this wasn't you, reset it right away.",
      text: "Your password was changed. If this wasn't you, reset it right away.",
    },
    twoFactor: {
      subject: (code) => `Your access code: ${code}`,
      heading: (name) => `Hi ${name}, here is your code`,
      expires: "It expires in 10 minutes. Never share it.",
      text: (code) => `Your access code is ${code}. It expires in 10 minutes.`,
    },
    welcome: {
      subject: "Welcome to eCommerce Web3!",
      heading: (name) => `Hi ${name}, your account is ready`,
      body: "You can now shop, save favorites, earn loyalty points and connect your wallet to receive NFT badges.",
      cta: "Go to the store",
      text: (name, url) => `Hi ${name}, your account is ready. Visit the store: ${url}`,
    },
    magicLink: {
      subject: "Your sign-in link",
      heading: (name) => `Hi ${name}`,
      body: "Use this link to sign in without a password. It expires in 15 minutes and works only once. If you didn't request it, ignore this message.",
      cta: "Sign in to my account",
      text: (url) => `Sign in with this link (expires in 15 minutes): ${url}`,
    },
  },
  sms: { phoneCode: (code) => `eCommerce Web3: your verification code is ${code}. Expires in 10 min.` },
};

export const MESSAGES: Record<Locale, Dictionary> = { es, en };

// renderNotification => genérico "<K>": los parámetros deben corresponder a la clave (tipado de punta a punta)
export function renderNotification<K extends NotificationKey>(locale: Locale, key: K, params: NotificationParams[K]): RenderedNotification {
  return MESSAGES[locale].notifications[key](params);
}

// renderStoredNotification => para documentos leídos de MongoDB (clave y parámetros llegan sin tipo): valida la
// clave y aplica los parámetros guardados. Devuelve null si la clave es desconocida (el llamador usa el texto guardado)
export function renderStoredNotification(locale: Locale, key: string | null | undefined, params: unknown): RenderedNotification | null {
  if (!key || !(NOTIFICATION_KEYS as readonly string[]).includes(key)) return null;
  const render = MESSAGES[locale].notifications[key as NotificationKey] as (params: unknown) => RenderedNotification;
  return render(params ?? {});
}

// renderLoyaltyReason => concepto del movimiento de puntos en el idioma pedido; texto libre (ajuste manual) tal cual
export function renderLoyaltyReason(locale: Locale, code: string | null, params: unknown, fallback: string): string {
  if (!code || !(LOYALTY_REASON_CODES as readonly string[]).includes(code)) return fallback;
  const render = MESSAGES[locale].loyaltyReasons[code as LoyaltyReasonCode] as (params: unknown) => string;
  return render(params ?? {});
}
