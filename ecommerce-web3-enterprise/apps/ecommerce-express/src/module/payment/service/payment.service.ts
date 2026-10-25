// payment.service.ts => pagos con Stripe (PSP exclusivo): PaymentIntent, webhook, anulación y reembolsos.
// Flujo: el navegador confirma el pago con Stripe Elements (la tarjeta NUNCA toca nuestro servidor: alcance PCI
// mínimo, SAQ-A) y Stripe notifica el resultado por webhook firmado, que es la ÚNICA fuente de verdad del cobro.
import crypto from "node:crypto";
import type Stripe from "stripe";
import { paymentRepository, toDto, type PaymentRepository } from "../repository/payment.repository";
import { isVoidable, refundableCents } from "../model/payment.model";
import { mapIntentStatus, refundedStatus, stripeCurrency } from "../util/payment.util";
import {
  InvalidWebhookSignatureException,
  PaymentNotFoundException,
  PaymentNotVoidableException,
  RefundExceedsPaymentException,
} from "../exception/payment.exception";
import type { OfflinePaymentDto, PaymentDto, PaymentIntentDto, SavedPaymentMethodDto, SetupIntentDto } from "../dto/payment.dto";
import { riskService } from "./risk.service";
import { assertNetwork, cryptoAmount, fiatRate, verifyTransfer, type CryptoAsset } from "../util/crypto-payment.util";
import { shippingService } from "../../shipping/service/shipping.service";
import { CONFIG_SCHEMAS } from "../../cms/schema/cms.schema";
import { cmsService } from "../../cms/service/cms.service";
import type { CheckoutRow } from "../../checkout/repository/checkout.repository";
import type { DeviceContext } from "../../../shared/util/device.util";
import { UnprocessableException } from "../../../shared/filter/http-exception.filter";
import { addMinutes } from "../../../shared/util/date.util";

const BANK_TRANSFER_HOLD_MINUTES = 48 * 60; // RF-08.3 la reserva espera 48 h la consignación
const CRYPTO_QUOTE_MINUTES = 15; // RF-08.9 la tasa cotizada vale 15 min (volatilidad)

// PaymentOptions => contexto del cobro: huella del dispositivo (RF-08.11) y, en un clic, el método guardado (RF-08.1)
interface PaymentOptions {
  device?: DeviceContext | undefined;
  paymentMethodId?: string | undefined;
  cardCountry?: string | null | undefined;
  returnUrl?: string | undefined;
}

// itemsCount / shippingCountry => lectura de los snapshots Json de la sesión para las señales de riesgo
const itemsCount = (session: CheckoutRow) => (Array.isArray(session.items) ? (session.items as Array<{ quantity?: number }>).reduce((sum, item) => sum + (item.quantity ?? 1), 0) : 1);
const shippingCountry = (session: CheckoutRow) => (session.shippingAddress as { country?: string } | null)?.country ?? null;
import type { ListPaymentsQuery } from "../schema/payment.schema";
import { checkoutService } from "../../checkout/service/checkout.service";
import { orderService } from "../../order/service/order.service";
import { commerceEvents } from "../../order/event/order.event";
import { getStripe } from "../../../config/stripe.config";
import { appConfig } from "../../../config/app.config";
import { prisma } from "../../../config/database.config";
import { buildPaginationMeta, toPageParams } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";
import { isAdmin } from "../../../shared/decorator/auth.decorator";
import { ConflictException, NotFoundException, ServiceUnavailableException } from "../../../shared/filter/http-exception.filter";
import { logger } from "../../../shared/middleware/logger.middleware";

interface Viewer {
  id: string;
  roles: string[];
}

export class PaymentService {
  constructor(private readonly repository: PaymentRepository) {}

  // processPayment => "procesar pago con Stripe": crea (o reutiliza) el PaymentIntent de la sesión de checkout.
  // RF-08.11: antes de cobrar se evalúa el riesgo (riesgo ALTO => 422 FRAUD_REVIEW). RF-08.1: con "paymentMethodId"
  // (método guardado) el intento se CONFIRMA en el servidor => pago en un clic (3-D Secure, si aplica, en el navegador)
  public async processPayment(checkoutSessionId: string, userId: string, options: PaymentOptions = {}): Promise<PaymentIntentDto> {
    const session = await checkoutService.requireForPayment(checkoutSessionId, userId);
    await this.assessRisk(session, userId, options);
    const stripe = getStripe();

    // Reutilización: si ya hay un intento abierto por el MISMO monto, se devuelve su client_secret (doble clic, recarga)
    const open = options.paymentMethodId ? null : await this.repository.findOpenForCheckout(checkoutSessionId);
    if (open && open.amountCents === session.totalCents) {
      const intent = await stripe.paymentIntents.retrieve(open.providerPaymentId);
      if (intent.client_secret) return { paymentId: open.id, clientSecret: intent.client_secret, amountCents: open.amountCents, currency: open.currency };
    }

    // RF-02.3: si el cliente ya tiene Customer en Stripe, el cobro queda asociado a él (historial y métodos guardados)
    const customer = (await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } }))?.stripeCustomerId;
    const intent = await stripe.paymentIntents.create(
      {
        amount: session.totalCents,
        currency: stripeCurrency(session.currency),
        ...(customer ? { customer } : {}), // Spread condicional: sin Customer el intento queda como invitado
        automatic_payment_methods: { enabled: true }, // Stripe decide los métodos disponibles (tarjeta, PSE, wallets)
        metadata: { checkoutSessionId, userId }, // Correlación en el webhook y en el dashboard de Stripe
        // RF-08.1 un clic: método guardado + confirmación inmediata (el cliente está presente: on-session)
        ...(options.paymentMethodId ? { payment_method: options.paymentMethodId, confirm: true, ...(options.returnUrl ? { return_url: options.returnUrl } : {}) } : {}),
      },
      // Clave de idempotencia: reintentos de red NUNCA crean dos cobros para la misma sesión y monto
      // (el Customer y el método entran en la clave: Stripe rechaza reutilizar una clave con parámetros distintos)
      { idempotencyKey: `checkout:${checkoutSessionId}:${session.totalCents}${customer ? `:${customer}` : ""}${options.paymentMethodId ? `:${options.paymentMethodId}` : ""}` }
    );
    if (!intent.client_secret) throw new ServiceUnavailableException("Stripe no devolvió client_secret");

    const payment = await this.repository.create({
      userId,
      checkoutSessionId,
      providerPaymentId: intent.id,
      amountCents: session.totalCents,
      currency: session.currency,
      status: mapIntentStatus(intent.status),
    });
    await checkoutService.markPaymentPending(checkoutSessionId);
    return { paymentId: payment.id, clientSecret: intent.client_secret, amountCents: payment.amountCents, currency: payment.currency, status: intent.status, checkoutSessionId };
  }

  // oneClick => RF-08.1 compra en un clic para usuarios registrados: carrito -> checkout con la dirección predeterminada
  // y la transportadora recomendada (RF-10.2) -> cobro con el método guardado predeterminado. Todo en UNA petición
  public async oneClick(userId: string, input: { returnUrl: string; points?: number | undefined; channel?: "WEB" | "SOCIAL" | "MARKETING" | undefined; channelRef?: string | undefined }, device: DeviceContext): Promise<PaymentIntentDto> {
    const methods = await savedPaymentMethodService.listPaymentMethods(userId);
    const method = methods.find((entry) => entry.isDefault) ?? methods[0];
    if (!method) throw new UnprocessableException("Guarda un método de pago en tu cuenta para comprar en un clic", "NO_SAVED_PAYMENT_METHOD");
    const address = await prisma.address.findFirst({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
    if (!address) throw new UnprocessableException("Agrega una dirección de envío para comprar en un clic", "NO_ADDRESS");

    const session = await checkoutService.initCheckout(userId, { points: input.points, channel: input.channel, channelRef: input.channelRef });
    const weight = session.items.reduce((sum, item) => sum + item.weightGrams * item.quantity, 0);
    const rates = await shippingService.quoteRates(address, weight, session.subtotalCents);
    const rate = rates.find((option) => option.recommended) ?? rates.find((option) => !option.pickup) ?? rates[0];
    if (!rate) throw new UnprocessableException("No hay envíos disponibles para tu dirección", "NO_SHIPPING_RATES");
    await checkoutService.updateCheckoutStep(session.id, userId, { addressId: address.id, shippingRateCode: rate.code });
    // "SESSION_ID" en returnUrl => la tienda no conoce aún la sesión: se reemplaza por la recién creada
    return this.processPayment(session.id, userId, { device, paymentMethodId: method.id, cardCountry: method.country, returnUrl: input.returnUrl.replace("SESSION_ID", session.id) });
  }

  // offlinePayment => RF-08.3 transferencia bancaria (la reserva espera 48 h la consignación; el ADMIN confirma) o
  // contra entrega (el pedido se coloca YA y el pago se marca cobrado al entregar). Requiere el medio activo en la config
  public async offlinePayment(checkoutSessionId: string, userId: string, method: "BANK_TRANSFER" | "CASH_ON_DELIVERY", device: DeviceContext): Promise<OfflinePaymentDto> {
    const session = await checkoutService.requireForPayment(checkoutSessionId, userId);
    const settings = await this.paymentSettings();
    if (method === "BANK_TRANSFER" && !settings.bankTransfer.enabled) throw new UnprocessableException("La transferencia bancaria no está habilitada", "PAYMENT_METHOD_DISABLED");
    if (method === "CASH_ON_DELIVERY" && !settings.cashOnDelivery) throw new UnprocessableException("El pago contra entrega no está habilitado", "PAYMENT_METHOD_DISABLED");
    await this.assessRisk(session, userId, { device });

    const reference = `PAY-${checkoutSessionId.slice(0, 8).toUpperCase()}`; // Referencia que el comprador escribe al consignar
    const { enabled: _enabled, ...bank } = settings.bankTransfer;
    const details = method === "BANK_TRANSFER" ? { ...bank, reference, amountCents: session.totalCents, currency: session.currency, payBefore: addMinutes(new Date(), BANK_TRANSFER_HOLD_MINUTES).toISOString() } : {};
    const providerPaymentId = `${method.toLowerCase()}_${checkoutSessionId}`; // Único por sesión y medio (reintentos idempotentes)
    const payment =
      (await this.repository.findByProviderId(providerPaymentId)) ??
      (await this.repository.create({ userId, checkoutSessionId, provider: method, providerPaymentId, amountCents: session.totalCents, currency: session.currency, status: "PENDING", details }));
    await checkoutService.markPaymentPending(checkoutSessionId, method === "BANK_TRANSFER" ? BANK_TRANSFER_HOLD_MINUTES : 15);
    const order = method === "CASH_ON_DELIVERY" ? await orderService.placeOrder(checkoutSessionId) : null;
    return { paymentId: payment.id, provider: method, status: payment.status, details, orderId: order?.id ?? null };
  }

  // confirmOfflinePayment => RF-08.3 el ADMIN confirma que la transferencia llegó => pago cobrado y pedido colocado
  public async confirmOfflinePayment(paymentId: string): Promise<void> {
    const payment = await this.repository.findById(paymentId);
    if (!payment) throw new PaymentNotFoundException(paymentId);
    if (payment.provider !== "BANK_TRANSFER" || payment.status !== "PENDING") throw new ConflictException("Solo se confirman transferencias pendientes", "NOT_PENDING_TRANSFER");
    await this.repository.update(paymentId, { status: "SUCCEEDED" });
    await orderService.placeOrder(payment.checkoutSessionId); // Si la reserva venció, responde 409 PAYMENT_NOT_CONFIRMED
  }

  // cryptoQuote => RF-08.9 conversión automática: total en moneda local -> monto exacto del activo a la tasa en vivo
  public async cryptoQuote(checkoutSessionId: string, userId: string, asset: CryptoAsset, network: string, device: DeviceContext): Promise<OfflinePaymentDto> {
    assertNetwork(asset, network);
    const session = await checkoutService.requireForPayment(checkoutSessionId, userId);
    const settings = await this.paymentSettings();
    const address = settings.crypto.networks.find((entry) => entry.network === network)?.address;
    if (!settings.crypto.enabled || !address) throw new UnprocessableException(`Los pagos en ${asset} por ${network} no están habilitados`, "PAYMENT_METHOD_DISABLED");
    await this.assessRisk(session, userId, { device });
    const rate = await fiatRate(asset, session.currency);
    const details = { asset, network, address, amount: cryptoAmount(asset, session.totalCents, rate), rate, fiatCents: session.totalCents, currency: session.currency, expiresAt: addMinutes(new Date(), CRYPTO_QUOTE_MINUTES).toISOString() };
    const payment = await this.repository.create({ userId, checkoutSessionId, provider: "CRYPTO", providerPaymentId: `crypto_quote_${crypto.randomUUID()}`, amountCents: session.totalCents, currency: session.currency, status: "PENDING", details });
    await checkoutService.markPaymentPending(checkoutSessionId, CRYPTO_QUOTE_MINUTES + 15); // Margen para confirmar en la red
    return { paymentId: payment.id, provider: "CRYPTO", status: payment.status, details, orderId: null };
  }

  // confirmCrypto => RF-08.9 sincronización con la blockchain: verifica la transacción ON-CHAIN (destino, monto y
  // confirmación). El hash pasa a ser el providerPaymentId (UNIQUE) => una transacción no paga dos pedidos (replay)
  public async confirmCrypto(paymentId: string, userId: string, txHash: string): Promise<{ orderId: string }> {
    const payment = await this.repository.findById(paymentId);
    if (!payment || payment.userId !== userId || payment.provider !== "CRYPTO") throw new PaymentNotFoundException(paymentId);
    if (payment.status !== "PENDING") throw new ConflictException("Este pago ya fue procesado", "PAYMENT_ALREADY_PROCESSED");
    const quote = payment.details as { asset: CryptoAsset; network: "bitcoin" | "ethereum" | "polygon"; address: string; amount: string };
    const hash = quote.network === "bitcoin" ? txHash.replace(/^0x/, "").toLowerCase() : `0x${txHash.replace(/^0x/, "").toLowerCase()}`;
    if (!(await verifyTransfer(quote.asset, quote.network, hash, quote.address, quote.amount))) {
      throw new UnprocessableException("No encontramos una transacción confirmada por el monto cotizado hacia la billetera de la tienda", "CRYPTO_TX_NOT_VERIFIED");
    }
    try {
      await this.repository.update(paymentId, { status: "SUCCEEDED", providerPaymentId: `crypto:${quote.network}:${hash}`, details: { ...quote, txHash: hash, confirmedAt: new Date().toISOString() } });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new ConflictException("Esa transacción ya se usó para otro pago", "TX_ALREADY_USED"); // UNIQUE violado
      throw error;
    }
    return { orderId: (await orderService.placeOrder(payment.checkoutSessionId)).id };
  }

  // paymentSettings => medios habilitados por el ADMIN (sección "payment"; inválida/ausente => todo apagado salvo Stripe)
  private async paymentSettings() {
    const configs = (await cmsService.getConfig(true).catch(() => [])) as Array<{ section: string; value: unknown }>; // Sin MongoDB => solo Stripe
    const parsed = CONFIG_SCHEMAS.payment.safeParse(configs.find((config) => config.section === "payment")?.value);
    return parsed.success ? parsed.data : CONFIG_SCHEMAS.payment.parse({ stripe: { enabled: true }, crypto: { enabled: false } });
  }

  // assessRisk => RF-08.10/08.11 señales + motor de fraude (DRY: todos los medios de pago pasan por aquí)
  private assessRisk(session: CheckoutRow, userId: string, options: PaymentOptions): Promise<void> {
    return riskService.assess({ userId, checkoutSessionId: session.id, amountCents: session.totalCents, itemCount: itemsCount(session), shippingCountry: shippingCountry(session), device: options.device ?? {}, cardCountry: options.cardCountry });
  }

  // listPayments => "historial de pagos con filtros" (el cliente ve los suyos; el admin, todos)
  public async listPayments(query: ListPaymentsQuery, viewer: Viewer): Promise<{ items: PaymentDto[]; meta: PaginationMeta }> {
    const page = toPageParams(query);
    const { items, total } = await this.repository.findMany(isAdmin(viewer) ? undefined : viewer.id, query.status, page, query.provider);
    return { items, meta: buildPaginationMeta(page, total) };
  }

  // getPaymentById => "transacción con estado y metadata por ID"
  public async getPaymentById(id: string, viewer: Viewer): Promise<PaymentDto> {
    const payment = await this.repository.findById(id);
    if (!payment || (payment.userId !== viewer.id && !isAdmin(viewer))) throw new PaymentNotFoundException(id);
    return toDto(payment);
  }

  // voidPayment => "anular pago en estado pendiente" (cancela el PaymentIntent en Stripe)
  public async voidPayment(id: string, viewer: Viewer): Promise<void> {
    const payment = await this.repository.findById(id);
    if (!payment || (payment.userId !== viewer.id && !isAdmin(viewer))) throw new PaymentNotFoundException(id);
    if (!isVoidable(payment.status)) throw new PaymentNotVoidableException(payment.status);

    await getStripe().paymentIntents.cancel(payment.providerPaymentId);
    await this.repository.update(id, { status: "CANCELLED" });
    await this.repository.reopenCheckout(payment.checkoutSessionId);
  }

  // handleWebhook => "evento Stripe autenticado por Stripe-Signature header"
  public async handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
    if (!appConfig.STRIPE_WEBHOOK_SECRET) throw new ServiceUnavailableException("STRIPE_WEBHOOK_SECRET no configurado");
    let event: Stripe.Event;
    try {
      // constructEvent => verifica la firma HMAC con el cuerpo CRUDO (por eso la ruta usa express.raw)
      event = getStripe().webhooks.constructEvent(rawBody, signature ?? "", appConfig.STRIPE_WEBHOOK_SECRET);
    } catch {
      throw new InvalidWebhookSignatureException();
    }

    // Idempotencia: un evento ya procesado se ignora (Stripe reintenta hasta recibir 2xx)
    const isNew = await this.repository.registerWebhookEvent(event.id, event.type, JSON.parse(JSON.stringify(event.data.object)));
    if (!isNew) return;

    // Despacho por tipo de evento (Strategy mediante switch sobre la unión discriminada "type")
    switch (event.type) {
      case "payment_intent.succeeded":
        await this.onIntentSucceeded(event.data.object);
        break;
      case "payment_intent.payment_failed":
        await this.onIntentFailed(event.data.object);
        break;
      case "payment_intent.requires_action":
      case "payment_intent.canceled":
        await this.syncIntent(event.data.object);
        break;
      default:
        logger.debug("stripe_event_ignored", { type: event.type });
    }
  }

  // refundPayment => ejecuta en Stripe una devolución APROBADA ("iniciar reembolso — nuevo registro inmutable")
  public async refundPayment(refundId: string): Promise<void> {
    const refund = await prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw new NotFoundException("Refund", refundId);
    if (refund.status !== "APPROVED") throw new ConflictException("Solo se ejecutan devoluciones aprobadas", "REFUND_NOT_APPROVED");

    const payment = await this.repository.findSucceededForOrder(refund.orderId);
    if (!payment) throw new ConflictException("El pedido no tiene un pago cobrado", "NO_CAPTURED_PAYMENT");
    const remaining = refundableCents(payment);
    if (refund.amountCents > remaining) throw new RefundExceedsPaymentException(remaining);

    // Pago MANUAL (pedido creado por el ADMIN): el dinero se devuelve fuera de Stripe; solo se registra el reembolso
    const providerRefundId =
      payment.provider !== "STRIPE" // Manual, transferencia, contra entrega o cripto: se devuelve fuera de Stripe
        ? `manual_${refundId}`
        : (
            await getStripe().refunds.create(
              { payment_intent: payment.providerPaymentId, amount: refund.amountCents, metadata: { refundId } },
              { idempotencyKey: `refund:${refundId}` } // Reintentar nunca devuelve el dinero dos veces
            )
          ).id;
    await this.repository.markRefundProcessed(
      refundId,
      payment.id,
      providerRefundId,
      refund.amountCents,
      refundedStatus(payment.amountCents, payment.refundedCents + refund.amountCents)
    );
    commerceEvents.emit("refund.updated", {
      userId: refund.userId,
      refundId,
      orderId: refund.orderId,
      status: "PROCESSED",
      amountCents: refund.amountCents,
      currency: payment.currency,
    });
  }

  // registerSubscribers => pedido cancelado antes del envío => reembolso total automático
  public registerSubscribers(): void {
    // RF-08.3 contra entrega: al ENTREGAR el pedido, el mensajero cobró => el pago queda cobrado
    commerceEvents.on("order.status-changed", async (event) => {
      if (event.to !== "DELIVERED") return;
      await prisma.payment.updateMany({ where: { orderId: event.orderId, provider: "CASH_ON_DELIVERY", status: "PENDING" }, data: { status: "SUCCEEDED" } });
    });
    commerceEvents.on("order.cancelled", async (event) => {
      const payment = await this.repository.findSucceededForOrder(event.orderId);
      if (!payment || refundableCents(payment) === 0) return;
      const refund = await prisma.refund.create({
        data: {
          orderId: event.orderId,
          userId: event.userId,
          paymentId: payment.id,
          reason: "OTHER",
          description: `Cancelación del pedido: ${event.reason}`,
          evidenceUrls: [],
          amountCents: refundableCents(payment),
          status: "APPROVED", // La cancelación ya fue autorizada: no requiere revisión manual
        },
      });
      await this.refundPayment(refund.id);
    });
  }

  // --- Manejadores de eventos de Stripe ---

  private async onIntentSucceeded(intent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.repository.findByProviderId(intent.id);
    if (!payment) {
      logger.warn("stripe_intent_unknown", { intent: intent.id }); // Intent creado fuera de esta app (ej. dashboard)
      return;
    }
    await this.repository.update(payment.id, { status: "SUCCEEDED", failureReason: null });
    // Pago confirmado => se coloca el pedido (idempotente; publica "order.placed" una sola vez)
    await orderService.placeOrder(payment.checkoutSessionId);
  }

  private async onIntentFailed(intent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.repository.findByProviderId(intent.id);
    if (!payment) return;
    const reason = intent.last_payment_error?.message ?? "Pago rechazado";
    await this.repository.update(payment.id, { status: "FAILED", failureReason: reason });
    await this.repository.reopenCheckout(payment.checkoutSessionId);
    commerceEvents.emit("payment.failed", { userId: payment.userId, checkoutSessionId: payment.checkoutSessionId, reason });
  }

  private async syncIntent(intent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.repository.findByProviderId(intent.id);
    if (payment) await this.repository.update(payment.id, { status: mapIntentStatus(intent.status) });
  }
}

// ---------- RF-02.3 Métodos de pago guardados (tokenizados en Stripe) ----------
// Patrón Facade sobre la API de Stripe: el resto del sistema solo ve DTOs propios (SavedPaymentMethodDto), nunca
// objetos de Stripe. La tarjeta se tokeniza en el navegador con un SetupIntent: nuestro servidor jamás ve el número.
export class SavedPaymentMethodService {
  // ensureCustomer => Customer de Stripe del usuario (lo crea la primera vez). Clave de idempotencia por usuario:
  // dos peticiones simultáneas nunca crean dos Customers
  private async ensureCustomer(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true, lastName: true, stripeCustomerId: true } });
    if (!user) throw new NotFoundException("Usuario no encontrado");
    if (user.stripeCustomerId) return user.stripeCustomerId;
    const customer = await getStripe().customers.create(
      { email: user.email, name: `${user.firstName} ${user.lastName}`.trim(), metadata: { userId } },
      { idempotencyKey: `customer:${userId}` }
    );
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
    return customer.id;
  }

  // createSetupIntent => paso 1 para guardar un método: Stripe Elements lo confirma en el navegador con el client_secret
  public async createSetupIntent(userId: string): Promise<SetupIntentDto> {
    const intent = await getStripe().setupIntents.create({
      customer: await this.ensureCustomer(userId),
      automatic_payment_methods: { enabled: true }, // Mismos métodos que el checkout (configurables en Stripe)
      usage: "on_session", // Se reutiliza con el cliente presente (checkout), no para cobros automáticos
      metadata: { userId },
    });
    if (!intent.client_secret) throw new ServiceUnavailableException("Stripe no devolvió client_secret");
    return { clientSecret: intent.client_secret };
  }

  // listPaymentMethods => métodos guardados del usuario (sin Customer todavía => lista vacía, sin llamar a Stripe)
  public async listPaymentMethods(userId: string): Promise<SavedPaymentMethodDto[]> {
    const customerId = (await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } }))?.stripeCustomerId;
    if (!customerId) return [];
    const stripe = getStripe();
    // En paralelo: métodos del Customer + el Customer (su método predeterminado de facturación)
    const [methods, customer] = await Promise.all([stripe.customers.listPaymentMethods(customerId, { limit: 20 }), stripe.customers.retrieve(customerId)]);
    const defaultId = "deleted" in customer && customer.deleted ? null : customer.invoice_settings?.default_payment_method;
    return methods.data.map((method) => ({
      id: method.id,
      type: method.type,
      brand: method.card?.brand ?? null,
      last4: method.card?.last4 ?? null,
      expMonth: method.card?.exp_month ?? null,
      expYear: method.card?.exp_year ?? null,
      country: method.card?.country ?? null,
      isDefault: (typeof defaultId === "string" ? defaultId : defaultId?.id) === method.id,
    }));
  }

  // setDefaultPaymentMethod => marca el método predeterminado (Customer.invoice_settings) tras validar el dueño
  public async setDefaultPaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    const customerId = await this.assertOwnership(userId, paymentMethodId);
    await getStripe().customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });
  }

  // deletePaymentMethod => "detach": Stripe invalida el token; no se puede volver a cobrar con él
  public async deletePaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    await this.assertOwnership(userId, paymentMethodId);
    await getStripe().paymentMethods.detach(paymentMethodId);
  }

  // assertOwnership => el token debe pertenecer al Customer del usuario (evita borrar/usar métodos ajenos — IDOR)
  private async assertOwnership(userId: string, paymentMethodId: string): Promise<string> {
    const customerId = (await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } }))?.stripeCustomerId;
    const method = customerId ? await getStripe().paymentMethods.retrieve(paymentMethodId).catch(() => null) : null; // 404 de Stripe => null
    const owner = typeof method?.customer === "string" ? method.customer : method?.customer?.id;
    if (!customerId || !method || owner !== customerId) throw new NotFoundException("Método de pago no encontrado");
    return customerId;
  }
}

export const paymentService = new PaymentService(paymentRepository);
export const savedPaymentMethodService = new SavedPaymentMethodService(); // Singleton
