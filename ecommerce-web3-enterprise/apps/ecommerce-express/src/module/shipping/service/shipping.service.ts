// shipping.service.ts => casos de uso de envíos: cotización, guía, estados con timeline y sincronización con el pedido.
import type { ShipmentStatus } from "@prisma/client";
import { shippingRepository, type ShippingRepository } from "../repository/shipping.repository";
import {
  canTransitionShipment,
  carrierCodeOf,
  carrierForRate,
  DEFAULT_SHIPPING_SETTINGS,
  PICKUP_RATE_CODE,
  quoteAll,
  recommendRate,
  trackingLink,
  type Destination,
  type ShippingSettings,
} from "../model/shipping.model";
import { geocode, suggestAddresses, type AddressSuggestion } from "../util/geo.util";
import { CONFIG_SCHEMAS } from "../../cms/schema/cms.schema";
import { cmsService } from "../../cms/service/cms.service";
import { notificationService } from "../../notification/service/notification.service";
import { RedisKeys } from "../../../config/redis.config";
import { cached } from "../../../shared/interceptor/cache.interceptor";
import { logger } from "../../../shared/middleware/logger.middleware";
import { InvalidShipmentTransitionException, NoShippingRatesException, ShipmentNotFoundException } from "../exception/shipping.exception";
import type { CarrierStatsDto, ShipmentDto, ShipmentTrackingDto, ShippingRateDto } from "../dto/shipping.dto";
import type { UpdateShippingInput } from "../schema/shipping.schema";
import { commerceEvents } from "../../order/event/order.event";
import { orderService } from "../../order/service/order.service";
import { renderShippingLabel } from "../../invoice/util/pdf.util";
import { prisma } from "../../../config/database.config";
import { appConfig } from "../../../config/app.config";
import { buildPaginationMeta, toPageParams, type PaginationQuery } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";
import { addDays } from "../../../shared/util/date.util";
import { isStaff } from "../../../shared/decorator/auth.decorator";
import { BadRequestException, NotFoundException } from "../../../shared/filter/http-exception.filter";

interface Viewer {
  id: string;
  roles: string[];
}

export class ShippingService {
  constructor(private readonly repository: ShippingRepository) {}

  // settings => RF-10.1/10.4/10.6 transportadoras, envío gratis y recogida en tienda configurados por el ADMIN (sección
  // "shipping" del CMS, ya cacheada); configuración ausente o inválida => valores por defecto (nunca rompe el checkout)
  public async settings(): Promise<ShippingSettings> {
    // MongoDB caído => se cotiza con los valores por defecto (el checkout no se detiene por la configuración)
    const configs = (await cmsService.getConfig(true).catch(() => [])) as Array<{ section: string; value: unknown }>;
    const parsed = CONFIG_SCHEMAS.shipping.safeParse(configs.find((config) => config.section === "shipping")?.value);
    return parsed.success ? parsed.data : DEFAULT_SHIPPING_SETTINGS;
  }

  // quoteRates => "generar cotización de tarifa según destino y peso" (también la usa el Checkout). RF-10.2: marca la
  // tarifa óptima (costo, tiempo y cumplimiento histórico de la transportadora)
  public async quoteRates(destination: Destination, weightGrams: number, subtotalCents: number): Promise<ShippingRateDto[]> {
    const [settings, onTime] = await Promise.all([this.settings(), this.onTimeRates()]);
    const rates = recommendRate(quoteAll(destination, weightGrams, subtotalCents, settings), onTime).map((rate) => ({ ...rate, currency: appConfig.DEFAULT_CURRENCY }));
    if (rates.length === 0) throw new NoShippingRatesException();
    return rates;
  }

  // suggestAddresses => RF-08.2 autocompletado de direcciones (OpenStreetMap, cacheado)
  public suggestAddresses(q: string): Promise<AddressSuggestion[]> {
    return suggestAddresses(q);
  }

  // carrierStats => RF-10.7 desempeño por transportadora (por defecto, últimos 90 días)
  public carrierStats(days = 90): Promise<CarrierStatsDto[]> {
    return this.repository.carrierStats(addDays(new Date(), -days));
  }

  // onTimeRates => cumplimiento por transportadora para la recomendación (cache 1 h: cambia despacio)
  private async onTimeRates(): Promise<Map<string, number>> {
    const rows = await cached(RedisKeys.report("carrier-on-time", "90d"), 3_600, () => this.carrierStats());
    return new Map(rows.filter((row) => row.delivered >= 5).map((row) => [row.carrier, row.onTimeRate])); // 5+ entregas: dato confiable
  }

  // tracking => RF-09.1/09.3/10.5 mapa del envío (último lugar del rastreo y destino) + contacto con la transportadora
  public async tracking(id: string, viewer: Viewer): Promise<ShipmentTrackingDto> {
    const shipment = await this.getShippingById(id, viewer);
    const order = await prisma.order.findUnique({ where: { id: shipment.orderId }, select: { shippingAddress: true } });
    const address = order?.shippingAddress as { city?: string; state?: string; country?: string } | null;
    const lastPlace = [...shipment.events].reverse().find((event) => event.location)?.location ?? null;
    const destinationQuery = address ? [address.city, address.state, address.country].filter(Boolean).join(", ") : null;
    // "Promise.all" => ambas geocodificaciones en paralelo (cada una cacheada 7 días)
    const [packagePoint, destination, settings] = await Promise.all([lastPlace ? geocode(lastPlace) : null, destinationQuery ? geocode(destinationQuery) : null, this.settings()]);
    const carrier = settings.carriers.find((entry) => entry.code === carrierCodeOf(shipment.rateCode));
    return {
      package: packagePoint,
      destination,
      carrier: shipment.carrier || carrier ? { name: carrier?.name ?? shipment.carrier ?? "", phone: carrier?.phone ?? null, trackingUrl: trackingLink(carrier, shipment.trackingNumber) } : null,
    };
  }

  // notifyDelayed => RF-09.6 job: avisa UNA vez (app, email y push) cuando un envío supera su fecha estimada
  public async notifyDelayed(batchSize = 100): Promise<number> {
    const delayed = await this.repository.findDelayed(new Date(), batchSize);
    for (const shipment of delayed) {
      await notificationService.notify(shipment.userId, { type: "SHIPPING", message: { key: "shipmentDelayed", params: { orderNumber: shipment.orderNumber } }, url: `/account/orders/${shipment.orderId}` });
      await this.repository.markDelayNotified(shipment.id);
    }
    if (delayed.length > 0) logger.info("shipment_delays_notified", { count: delayed.length });
    return delayed.length;
  }

  // quoteForAddress => cotiza con una dirección guardada del usuario (ownership incluido en la consulta)
  public async quoteForAddress(userId: string, addressId: string, weightGrams: number, subtotalCents: number): Promise<ShippingRateDto[]> {
    const address = await prisma.address.findFirst({ where: { id: addressId, userId } });
    if (!address) throw new NotFoundException("Address", addressId);
    return this.quoteRates(address, weightGrams, subtotalCents);
  }

  // recommendedRateFor => RF-10.2 asignación automática cuando el pedido no trae tarifa (venta asistida del staff)
  public async recommendedRateFor(destination: Destination, weightGrams: number, subtotalCents: number): Promise<ShippingRateDto | null> {
    const rates = await this.quoteRates(destination, weightGrams, subtotalCents).catch(() => []);
    return rates.find((rate) => rate.recommended) ?? rates[0] ?? null;
  }

  public async listShippings(query: PaginationQuery & { status?: ShipmentStatus | undefined }): Promise<{ items: ShipmentDto[]; meta: PaginationMeta }> {
    const page = toPageParams(query);
    const { items, total } = await this.repository.findMany(query.status, page);
    return { items, meta: buildPaginationMeta(page, total) };
  }

  // getShippingById => "envío con estado y guía por ID" (dueño del pedido o staff)
  public async getShippingById(id: string, viewer: Viewer): Promise<ShipmentDto> {
    const found = await this.repository.findById(id);
    if (!found || (found.userId !== viewer.id && !isStaff(viewer))) throw new ShipmentNotFoundException(id);
    return found.shipment;
  }

  // createShippingLabel => "generar guía con transportadora"
  public async createShippingLabel(shipmentId: string): Promise<ShipmentDto> {
    const found = await this.repository.findById(shipmentId);
    if (!found) throw new ShipmentNotFoundException(shipmentId);
    const { shipment } = found;
    if (!canTransitionShipment(shipment.status, "LABEL_CREATED")) throw new InvalidShipmentTransitionException(shipment.status, "LABEL_CREATED");

    const settings = await this.settings();
    const carrier = carrierForRate(shipment.rateCode, settings);
    if (!carrier) throw new BadRequestException(`Tarifa ${shipment.rateCode} sin transportadora`, "UNKNOWN_RATE");
    const { trackingNumber } = carrier.createLabel(shipment.rateCode);
    // Nombre visible de la transportadora configurada ("COORDINADORA_EXPRESS" => "Coordinadora" + "EXPRESS")
    const carrierName = settings.carriers.find((entry) => entry.code === carrierCodeOf(shipment.rateCode))?.name ?? carrierCodeOf(shipment.rateCode);
    const service = shipment.rateCode === PICKUP_RATE_CODE ? "PICKUP" : shipment.rateCode.split("_")[1];

    const updated = await this.repository.transition(
      shipmentId,
      "LABEL_CREATED",
      { description: `Guía ${trackingNumber} generada` },
      {
        trackingNumber,
        carrier: carrierName,
        service: service ?? null,
        labelUrl: `${appConfig.API_BASE_URL}/api/v1/shipping/${shipmentId}/label`,
      }
    );
    this.publish(found.userId, updated);
    return updated;
  }

  // voidShippingLabel => anula la guía: solo en LABEL_CREATED (el paquete aún no salió); vuelve a PENDING sin número
  // de guía, así se puede generar otra. Queda un evento en el historial del envío (auditoría).
  public async voidShippingLabel(shipmentId: string): Promise<ShipmentDto> {
    const found = await this.repository.findById(shipmentId);
    if (!found) throw new ShipmentNotFoundException(shipmentId);
    if (found.shipment.status !== "LABEL_CREATED") throw new InvalidShipmentTransitionException(found.shipment.status, "PENDING");
    const updated = await this.repository.transition(
      shipmentId,
      "PENDING",
      { description: `Guía ${found.shipment.trackingNumber ?? ""} anulada` },
      { trackingNumber: null, labelUrl: null, carrier: null, service: null }
    );
    this.publish(found.userId, updated);
    return updated;
  }

  // renderLabel => PDF de la guía (PDFKit) para imprimir y pegar en el paquete
  public async renderLabel(shipmentId: string): Promise<Buffer> {
    const found = await this.repository.findById(shipmentId);
    if (!found?.shipment.trackingNumber) throw new ShipmentNotFoundException(shipmentId);
    const order = await orderService.getOrderById(found.shipment.orderId, { id: "system", roles: ["ADMIN"] });
    const weightGrams = await prisma.orderItem
      .findMany({ where: { orderId: order.id }, select: { quantity: true, variant: { select: { weightGrams: true } } } })
      .then((items) => items.reduce((sum, item) => sum + item.quantity * (item.variant?.weightGrams ?? 0), 0));
    return renderShippingLabel({
      trackingNumber: found.shipment.trackingNumber,
      carrier: found.shipment.carrier ?? "",
      service: found.shipment.service ?? "",
      orderNumber: order.orderNumber,
      sender: "eCommerce Web3 · Bogotá, Colombia",
      recipient: order.shippingAddress,
      weightGrams,
    });
  }

  // updateShipping => "actualizar estado del envío — PATCH parcial" (+ evento de rastreo)
  public async updateShipping(id: string, input: UpdateShippingInput): Promise<ShipmentDto> {
    const found = await this.repository.findById(id);
    if (!found) throw new ShipmentNotFoundException(id);
    if (!canTransitionShipment(found.shipment.status, input.status)) {
      throw new InvalidShipmentTransitionException(found.shipment.status, input.status);
    }

    const now = new Date();
    const updated = await this.repository.transition(
      id,
      input.status,
      { description: input.description ?? DEFAULT_DESCRIPTIONS[input.status], location: input.location },
      {
        ...(input.status === "IN_TRANSIT" ? { shippedAt: now } : {}),
        ...(input.status === "DELIVERED" ? { deliveredAt: now } : {}),
      }
    );
    // El envío manda sobre SHIPPED/DELIVERED del pedido
    await orderService.syncFromShipment(updated.orderId, input.status);
    this.publish(found.userId, updated);
    return updated;
  }

  // deleteShippingById => "cancelar envío pendiente"
  public async deleteShippingById(id: string): Promise<void> {
    await this.updateShipping(id, { status: "CANCELLED", description: "Envío cancelado" });
  }

  // registerSubscribers => reacciones del módulo a eventos de otros módulos (Observer; se registra en el bootstrap)
  public registerSubscribers(): void {
    // Pedido colocado => se crea el envío PENDING con la tarifa elegida en el checkout. Sin tarifa (pedido del staff)
    // se asigna automáticamente la transportadora óptima para la dirección (RF-10.2)
    commerceEvents.on("order.placed", async (event) => {
      const order = await prisma.order.findUnique({
        where: { id: event.orderId },
        select: { shippingCents: true, subtotalCents: true, shippingAddress: true, checkoutSession: { select: { shippingRateCode: true } } },
      });
      const chosen = order?.checkoutSession.shippingRateCode;
      const address = order?.shippingAddress as Destination | undefined;
      const auto = !chosen && address ? await this.recommendedRateFor(address, 1_000, order?.subtotalCents ?? 0) : null;
      const rateCode = chosen ?? auto?.code ?? `${DEFAULT_SHIPPING_SETTINGS.carriers[0]?.code ?? "SERVIENTREGA"}_STANDARD`;
      const etaDays = rateCode === PICKUP_RATE_CODE ? 1 : rateCode.startsWith("DHL") ? 5 : (auto?.estimatedDays ?? 3);
      await this.repository.createForOrder({ orderId: event.orderId, rateCode, costCents: order?.shippingCents ?? 0, estimatedDelivery: addDays(new Date(), etaDays) });
    });

    // Pedido cancelado => se cancela el envío si aún no salió
    commerceEvents.on("order.cancelled", async (event) => {
      const shipment = await this.repository.findByOrderId(event.orderId);
      if (shipment && canTransitionShipment(shipment.status, "CANCELLED")) {
        await this.repository.transition(shipment.id, "CANCELLED", { description: `Pedido cancelado: ${event.reason}` });
      }
    });
  }

  private publish(userId: string, shipment: ShipmentDto): void {
    commerceEvents.emit("shipment.updated", {
      userId,
      orderId: shipment.orderId,
      orderNumber: shipment.orderNumber,
      shipmentId: shipment.id,
      status: shipment.status,
      trackingNumber: shipment.trackingNumber,
    });
  }
}

// Textos por defecto del timeline (legibles para el cliente)
const DEFAULT_DESCRIPTIONS: Record<ShipmentStatus, string> = {
  PENDING: "Preparando envío",
  LABEL_CREATED: "Guía generada",
  IN_TRANSIT: "El paquete va en camino",
  OUT_FOR_DELIVERY: "El paquete está en reparto",
  DELIVERED: "Entregado",
  CANCELLED: "Envío cancelado",
  RETURNED: "Devuelto al remitente",
};

export const shippingService = new ShippingService(shippingRepository);
