// config.validator.ts (Zod) => schemas de los formularios de configuración global (pagos, envío, impuestos, moneda).
// Mismas reglas que CONFIG_SCHEMAS de Express; aquí en unidades amigables (pesos y %) que se convierten a lo que
// guarda el backend (centavos y fracción) con "transform" (Adapter dentro del schema). Sin secretos: la llave privada
// de Stripe vive solo en el .env de Express; aquí únicamente la PÚBLICA (pk_...).
import { z } from "zod";

const pesos = z.coerce.number({ invalid_type_error: "validation.number" }).min(0, "validation.positive").transform((value) => Math.round(value * 100));
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "validation.currency");

export const paymentSchema = z.object({
  stripeEnabled: z.boolean(),
  publishableKey: z.string().trim().regex(/^pk_(test|live)_\w+$/, "validation.stripeKey").optional().or(z.literal("").transform(() => undefined)),
  statementDescriptor: z.string().trim().max(22).optional().transform((value) => value || undefined),
  cryptoEnabled: z.boolean(),
  networks: z.array(z.object({ network: z.enum(["ethereum", "polygon", "solana", "bitcoin"]), address: z.string().trim().min(26, "validation.wallet").max(64) })).max(5),
  cashOnDelivery: z.boolean(),
  // RF-08.3 transferencia bancaria
  bankEnabled: z.boolean(),
  bankName: z.string().trim().max(60),
  accountType: z.string().trim().max(30),
  accountNumber: z.string().trim().max(40),
  holder: z.string().trim().max(120),
  holderId: z.string().trim().max(30),
});

export const shippingSchema = z.object({
  carriers: z
    .array(
      z.object({
        code: z.string().trim().toUpperCase().min(2, "validation.required").max(20),
        name: z.string().trim().min(2, "validation.required").max(60),
        enabled: z.boolean(),
        base: pesos,
        perKg: pesos,
        etaDays: z.coerce.number().int().min(0).max(60),
        phone: z.string().trim().max(30).optional(), // RF-09.3
        trackingUrl: z.string().trim().url("validation.url").max(300).optional().or(z.literal("")),
      })
    )
    .max(10),
  freeShippingOver: z.union([z.literal(""), pesos]).transform((value) => (value === "" ? null : value)),
  pickupEnabled: z.boolean(), // RF-08.2
  pickupAddress: z.string().trim().max(160),
});

export const taxSchema = z.object({
  pricesIncludeTax: z.boolean(),
  rates: z.array(z.object({ region: z.string().trim().min(2, "validation.required").max(60), percent: z.coerce.number().min(0).max(100) })).max(50),
});

// returnsSchema => RF-12.6 mismo rango que CONFIG_SCHEMAS.returns de Express
export const returnsSchema = z.object({
  windowDays: z.coerce.number().int().min(1, "validation.required").max(365),
  requirePhotos: z.boolean(),
});

export const currencySchema = z.object({
  default: currency,
  supported: z.string().transform((value) => [...new Set(value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean))]).pipe(z.array(currency).min(1, "validation.required").max(10)),
});

// ---------- Adapters formulario -> valor guardado en Express ----------
export const toPayment = (values: z.output<typeof paymentSchema>) => ({
  stripe: { enabled: values.stripeEnabled, publishableKey: values.publishableKey, statementDescriptor: values.statementDescriptor },
  crypto: { enabled: values.cryptoEnabled, networks: values.networks },
  cashOnDelivery: values.cashOnDelivery,
  bankTransfer: { enabled: values.bankEnabled, bankName: values.bankName, accountType: values.accountType, accountNumber: values.accountNumber, holder: values.holder, holderId: values.holderId },
});
export const toShipping = (values: z.output<typeof shippingSchema>) => ({
  carriers: values.carriers.map(({ base, perKg, trackingUrl, ...carrier }) => ({ ...carrier, baseCents: base, perKgCents: perKg, ...(trackingUrl ? { trackingUrl } : {}) })),
  freeShippingOverCents: values.freeShippingOver,
  storePickup: { enabled: values.pickupEnabled, address: values.pickupAddress },
});
export const toTax = (values: z.output<typeof taxSchema>) => ({ pricesIncludeTax: values.pricesIncludeTax, rates: values.rates.map((rate) => ({ region: rate.region, rate: rate.percent / 100 })) });
