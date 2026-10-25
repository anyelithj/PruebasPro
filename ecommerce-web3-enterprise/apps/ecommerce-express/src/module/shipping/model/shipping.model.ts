// shipping.model.ts => transportadoras como patrón STRATEGY + máquina de estados del envío (patrón State declarativo).
// Cada transportadora implementa la misma interfaz (cotizar y generar guía). Las nacionales (Servientrega,
// Coordinadora, Deprisa...) salen de la CONFIGURACIÓN de la tienda (RF-10.1/10.4/10.6: el administrador las activa,
// desactiva y tarifa desde el panel, sin desplegar código): una sola clase ConfiguredCarrierStrategy las representa a
// todas (Data-Driven). Las APIs reales de cada transportadora requieren contrato y credenciales: para integrarlas se
// agrega una estrategia que llame a su API (OCP) sin tocar el service ni el checkout.
// Paradigma funcional en las reglas (funciones puras: cotizar, recomendar, transiciones).
import crypto from "node:crypto";
import type { ShipmentStatus } from "@prisma/client";

export interface Destination {
  country: string; // ISO alpha-2
  state: string;
  city: string;
  postalCode: string;
}

export interface RateQuote {
  code: string; // Identificador estable de la tarifa (se guarda en el checkout y en el shipment)
  carrier: string;
  service: string;
  costCents: number;
  estimatedDays: number;
  pickup?: boolean; // RF-08.2 true => recogida en tienda (sin dirección de entrega)
  recommended?: boolean; // RF-10.2 la transportadora óptima para este destino (la UI la preselecciona)
}

export interface LabelResult {
  trackingNumber: string;
}

// "interface CarrierStrategy" => contrato de todas las transportadoras (ISP: solo lo que el dominio necesita)
export interface CarrierStrategy {
  owns(rateCode: string): boolean; // ¿Esta transportadora emitió ese código de tarifa?
  quote(destination: Destination, weightGrams: number, subtotalCents: number): RateQuote[];
  createLabel(rateCode: string): LabelResult;
}

// CarrierSettings / ShippingSettings => forma de la sección "shipping" de la configuración (CONFIG_SCHEMAS en cms)
export interface CarrierSettings {
  code: string; // "SERVIENTREGA" => tarifas SERVIENTREGA_STANDARD / SERVIENTREGA_EXPRESS
  name: string;
  enabled: boolean;
  baseCents: number; // Tarifa base nacional
  perKgCents: number; // Valor por kilo facturable
  etaDays: number; // Días hábiles a destino nacional
  phone?: string | undefined; // RF-09.3 línea de atención (el cliente contacta al mensajero)
  trackingUrl?: string | undefined; // RF-09.3 rastreo en la web de la transportadora; "{tracking}" se reemplaza
}
export interface ShippingSettings {
  carriers: CarrierSettings[];
  freeShippingOverCents: number | null; // RF-08.2 envío estándar gratis desde este subtotal (null = nunca)
  storePickup?: { enabled: boolean; address: string } | undefined; // RF-08.2 recogida en tienda
}

// Valores por defecto (mientras el administrador no guarde su configuración): las 3 transportadoras de la matriz
export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  carriers: [
    { code: "SERVIENTREGA", name: "Servientrega", enabled: true, baseCents: 1_200_000, perKgCents: 300_000, etaDays: 3, phone: "+576017700200", trackingUrl: "https://www.servientrega.com/wps/portal/rastreo-envio?guia={tracking}" },
    { code: "COORDINADORA", name: "Coordinadora", enabled: true, baseCents: 1_150_000, perKgCents: 320_000, etaDays: 3, phone: "+576044444555", trackingUrl: "https://coordinadora.com/rastreo/rastreo-de-guia/detalle-de-rastreo-de-guia/?guia={tracking}" },
    { code: "DEPRISA", name: "Deprisa", enabled: true, baseCents: 1_300_000, perKgCents: 280_000, etaDays: 2, phone: "+576014238080", trackingUrl: "https://www.deprisa.com/rastreo?guia={tracking}" },
  ],
  freeShippingOverCents: 30_000_000, // $300.000
  storePickup: { enabled: true, address: "Tienda eCommerce Web3 · Bogotá" },
};

export const PICKUP_RATE_CODE = "PICKUP_STORE";
const ORIGIN_CITY = "bogota";
// Departamentos de difícil acceso (tarifa y tiempo mayores)
const REMOTE_STATES = new Set(["amazonas", "guainia", "vaupes", "vichada", "guaviare", "putumayo", "san andres"]);
type Zone = "LOCAL" | "NATIONAL" | "REMOTE";
const ZONE_MULTIPLIER: Record<Zone, number> = { LOCAL: 0.8, NATIONAL: 1, REMOTE: 1.8 };
const ZONE_EXTRA_DAYS: Record<Zone, number> = { LOCAL: -2, NATIONAL: 0, REMOTE: 4 };
const EXPRESS_MULTIPLIER = 1.6;

// normalize => minúsculas sin tildes para comparar nombres de ciudad/departamento
const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

// Peso facturable: mínimo 1 kg y redondeo hacia arriba por kilo (práctica estándar de las transportadoras)
const billableKg = (weightGrams: number) => Math.max(1, Math.ceil(weightGrams / 1000));

// zoneOf => zona tarifaria del destino nacional (función pura)
const zoneOf = (destination: Destination): Zone =>
  normalize(destination.city) === ORIGIN_CITY ? "LOCAL" : REMOTE_STATES.has(normalize(destination.state)) ? "REMOTE" : "NATIONAL";

// trackingNumber => prefijo de la transportadora + 10 caracteres aleatorios
const trackingNumber = (prefix: string) => `${prefix}${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

// --- Transportadora nacional configurada (Servientrega, Coordinadora, Deprisa...): estándar y express ---
class ConfiguredCarrierStrategy implements CarrierStrategy {
  constructor(
    private readonly carrier: CarrierSettings,
    private readonly freeShippingOverCents: number | null
  ) {}

  public owns(rateCode: string): boolean {
    return rateCode.startsWith(`${this.carrier.code}_`);
  }

  public quote(destination: Destination, weightGrams: number, subtotalCents: number): RateQuote[] {
    if (destination.country !== "CO") return []; // Solo opera en Colombia
    const zone = zoneOf(destination);
    const days = Math.max(1, this.carrier.etaDays + ZONE_EXTRA_DAYS[zone]);
    const standard = Math.round((this.carrier.baseCents + billableKg(weightGrams) * this.carrier.perKgCents) * ZONE_MULTIPLIER[zone]);
    // Regla comercial (RF-08.2): estándar gratis desde el monto configurado, excepto zonas remotas
    const free = this.freeShippingOverCents !== null && subtotalCents >= this.freeShippingOverCents && zone !== "REMOTE";
    return [
      { code: `${this.carrier.code}_STANDARD`, carrier: this.carrier.name, service: "Estándar", costCents: free ? 0 : standard, estimatedDays: days },
      { code: `${this.carrier.code}_EXPRESS`, carrier: this.carrier.name, service: "Express", costCents: Math.round(standard * EXPRESS_MULTIPLIER), estimatedDays: Math.max(1, Math.ceil(days / 2)) },
    ];
  }

  public createLabel(): LabelResult {
    return { trackingNumber: trackingNumber(this.carrier.code.slice(0, 3)) };
  }
}

// --- RF-08.2 Recogida en tienda: gratis, lista en 1 día, solo en Colombia ---
class StorePickupStrategy implements CarrierStrategy {
  constructor(private readonly address: string) {}

  public owns(rateCode: string): boolean {
    return rateCode === PICKUP_RATE_CODE;
  }

  public quote(destination: Destination): RateQuote[] {
    return destination.country === "CO" ? [{ code: PICKUP_RATE_CODE, carrier: "Recogida en tienda", service: this.address, costCents: 0, estimatedDays: 1, pickup: true }] : [];
  }

  public createLabel(): LabelResult {
    return { trackingNumber: trackingNumber("PU") }; // Código de retiro que el cliente presenta en la tienda
  }
}

// --- DHL Express (internacional) ---
class DhlExpressStrategy implements CarrierStrategy {
  public owns(rateCode: string): boolean {
    return rateCode.startsWith("DHL_");
  }

  public quote(destination: Destination, weightGrams: number): RateQuote[] {
    if (destination.country === "CO") return [];
    return [{ code: "DHL_EXPRESS", carrier: "DHL", service: "Express Worldwide", costCents: 18_000_000 + billableKg(weightGrams) * 6_000_000, estimatedDays: 5 }];
  }

  public createLabel(): LabelResult {
    return { trackingNumber: trackingNumber("DHL") };
  }
}

// buildCarriers => Registry de estrategias a partir de la configuración: solo las transportadoras ACTIVAS (RF-10.4)
export function buildCarriers(settings: ShippingSettings = DEFAULT_SHIPPING_SETTINGS): CarrierStrategy[] {
  return [
    ...settings.carriers.filter((carrier) => carrier.enabled).map((carrier) => new ConfiguredCarrierStrategy(carrier, settings.freeShippingOverCents)),
    ...(settings.storePickup?.enabled ? [new StorePickupStrategy(settings.storePickup.address)] : []),
    new DhlExpressStrategy(),
  ];
}

// carrierForRate => estrategia dueña de un código de tarifa (cada estrategia decide con "owns": sin índices mágicos).
// Incluye las inactivas: una guía de un pedido ya pagado se genera aunque la transportadora se haya desactivado después
export function carrierForRate(rateCode: string, settings: ShippingSettings = DEFAULT_SHIPPING_SETTINGS): CarrierStrategy | undefined {
  return buildCarriers({ ...settings, carriers: settings.carriers.map((carrier) => ({ ...carrier, enabled: true })), storePickup: settings.storePickup && { ...settings.storePickup, enabled: true } }).find((carrier) => carrier.owns(rateCode));
}

// carrierCodeOf => "COORDINADORA_EXPRESS" -> "COORDINADORA" (agrupa estadísticas y dependencias por transportadora)
export const carrierCodeOf = (rateCode: string): string => rateCode.split("_")[0] ?? rateCode;

// recommendRate => RF-10.2 asignación automática de la transportadora óptima: puntaje = 60 % costo + 40 % tiempo
// (normalizados al rango de las opciones) ajustado por el cumplimiento histórico de cada transportadora (RF-10.7).
// No compite la recogida en tienda (exige que el cliente se desplace). Función pura.
export function recommendRate(rates: RateQuote[], onTimeRate: ReadonlyMap<string, number> = new Map()): RateQuote[] {
  const candidates = rates.filter((rate) => !rate.pickup);
  if (candidates.length === 0) return rates;
  const span = (values: number[]) => ({ min: Math.min(...values), range: Math.max(...values) - Math.min(...values) || 1 });
  const cost = span(candidates.map((rate) => rate.costCents));
  const days = span(candidates.map((rate) => rate.estimatedDays));
  // Menor puntaje = mejor; un 100 % de entregas a tiempo resta hasta 0.3 (sin historial se asume 0.8: neutro)
  const score = (rate: RateQuote) =>
    0.6 * ((rate.costCents - cost.min) / cost.range) + 0.4 * ((rate.estimatedDays - days.min) / days.range) - 0.3 * ((onTimeRate.get(carrierCodeOf(rate.code)) ?? 0.8) - 0.8);
  const best = candidates.reduce((winner, rate) => (score(rate) < score(winner) ? rate : winner));
  return rates.map((rate) => ({ ...rate, recommended: rate.code === best.code }));
}

// quoteAll => une las cotizaciones de todas las transportadoras activas, de la más barata a la más cara
export function quoteAll(destination: Destination, weightGrams: number, subtotalCents: number, settings: ShippingSettings = DEFAULT_SHIPPING_SETTINGS): RateQuote[] {
  return buildCarriers(settings)
    .flatMap((carrier) => carrier.quote(destination, weightGrams, subtotalCents))
    .sort((a, b) => a.costCents - b.costCents);
}

// trackingLink => RF-09.3 URL de rastreo en la web de la transportadora (null si no la configuró)
export function trackingLink(carrier: CarrierSettings | undefined, tracking: string | null): string | null {
  return carrier?.trackingUrl && tracking ? carrier.trackingUrl.replace("{tracking}", encodeURIComponent(tracking)) : null;
}

// Máquina de estados del envío: estado -> estados a los que puede pasar (patrón State como tabla de transiciones)
const TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING: ["LABEL_CREATED", "CANCELLED"],
  LABEL_CREATED: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "DELIVERED", "RETURNED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

// OPEN_SHIPMENT_STATUSES => envíos aún en curso (retrasos RF-09.6 y dependencias de transportadora RF-10.4)
export const OPEN_SHIPMENT_STATUSES: ShipmentStatus[] = ["PENDING", "LABEL_CREATED", "IN_TRANSIT", "OUT_FOR_DELIVERY"];

// isShipmentDelayed => RF-09.6 en curso y con la fecha estimada vencida (función pura: la usan envío y pedido, DRY)
export function isShipmentDelayed(status: ShipmentStatus, estimatedDelivery: Date | null, now = new Date()): boolean {
  return OPEN_SHIPMENT_STATUSES.includes(status) && estimatedDelivery !== null && estimatedDelivery < now;
}

export function canTransitionShipment(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
