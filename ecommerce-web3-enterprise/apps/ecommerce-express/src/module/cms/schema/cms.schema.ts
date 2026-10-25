// cms.schema.ts (Zod) => validación de entrada del módulo CMS: contenido por tipo (data propio de cada uno), filtros
// del listado, leads de landing y configuración de tienda por sección. "z.infer" deriva los tipos (DRY).
import { z } from "zod";
import { ConfigSections, ContentKinds, ContentStatuses } from "../model/cms.model";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";

const Slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "slug: minúsculas, números y guiones" }).max(120);
const Url = z.string().url().max(500);
const Cents = z.number().int().min(0);

export const KindParamSchema = z.object({ kind: z.enum(ContentKinds) });
export const SlugParamSchema = KindParamSchema.extend({ slug: Slug });
export const SectionParamSchema = z.object({ section: z.enum(ConfigSections) });

// "data" por tipo (Strategy de validación): landing => oferta con cuenta regresiva y CTA; evento => fechas y lugar
const LandingData = z.object({
  headline: z.string().trim().max(160).optional(),
  ctaLabel: z.string().trim().max(60).optional(),
  ctaUrl: z.string().trim().max(300).optional(),
  couponCode: z.string().trim().toUpperCase().max(30).optional(),
  endsAt: z.coerce.date().optional(), // Fin de la oferta (cuenta regresiva)
  testimonials: z.array(z.object({ author: z.string().trim().max(80), quote: z.string().trim().max(400) })).max(12).default([]),
});
const EventData = z
  .object({
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    location: z.string().trim().max(200).default("Online"),
    online: z.boolean().default(true),
    url: Url.optional(),
  })
  .refine((value) => value.endsAt > value.startsAt, { message: "endsAt debe ser posterior a startsAt", path: ["endsAt"] });
export const DATA_SCHEMAS = { page: z.object({}).passthrough(), lookbook: z.object({ season: z.string().trim().max(60).optional() }), landing: LandingData, event: EventData } as const;

const MediaSchema = z.object({
  url: Url,
  publicId: z.string().max(200).nullable().optional(),
  alt: z.string().trim().min(1, { message: "El texto alternativo es obligatorio" }).max(160),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  hotspots: z.array(z.object({ productId: z.string().uuid(), x: z.number().min(0).max(100), y: z.number().min(0).max(100) })).max(20).default([]),
});

// Campos comunes de cualquier contenido (el "data" se valida aparte según el kind de la URL)
export const ContentSchema = z.object({
  slug: Slug,
  title: z.string().trim().min(3).max(160),
  summary: z.string().trim().max(500).default(""),
  locale: z.enum(["es", "en"]).default("es"),
  status: z.enum(ContentStatuses).default("DRAFT"),
  seo: z.object({ title: z.string().trim().max(70).nullable().optional(), description: z.string().trim().max(160).nullable().optional(), imageUrl: Url.nullable().optional() }).default({}),
  body: z.object({ html: z.string().max(500_000).default(""), css: z.string().max(200_000).default(""), project: z.record(z.unknown()).nullable().default(null) }).default({}),
  media: z.array(MediaSchema).max(40).default([]),
  productIds: z.array(z.string().uuid()).max(60).default([]),
  data: z.record(z.unknown()).default({}),
});
export const UpdateContentSchema = ContentSchema.partial();

export const ListContentQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(ContentStatuses).optional(), // Solo staff: el público siempre ve PUBLISHED
  locale: z.enum(["es", "en"]).optional(),
  q: z.string().trim().max(100).optional(),
  upcoming: z.enum(["true", "false"]).transform((value) => value === "true").optional(), // Eventos que aún no terminan
});

export const LeadSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().max(120).optional(),
  consent: z.literal(true, { errorMap: () => ({ message: "Debes aceptar la política de datos" }) }),
  source: z.string().trim().max(120).optional(),
});
export const ListLeadsQuerySchema = PaginationQuerySchema.extend({ landing: Slug.optional() });

// Configuración por sección (sin secretos: solo banderas, llaves PÚBLICAS y reglas de negocio)
export const CONFIG_SCHEMAS = {
  payment: z.object({
    stripe: z.object({ enabled: z.boolean(), publishableKey: z.string().regex(/^pk_(test|live)_\w+$/, { message: "Llave pública de Stripe (pk_...)" }).optional(), statementDescriptor: z.string().max(22).optional() }),
    // RF-08.3/08.9 cripto: dirección receptora por red (bitcoin para BTC; ethereum/polygon para ETH, USDT y USDC)
    crypto: z.object({ enabled: z.boolean(), networks: z.array(z.object({ network: z.enum(["ethereum", "polygon", "solana", "bitcoin"]), address: z.string().trim().min(26).max(64) })).max(5).default([]) }),
    cashOnDelivery: z.boolean().default(false),
    // RF-08.3 transferencia bancaria: datos que se muestran al comprador para consignar (información pública)
    bankTransfer: z
      .object({
        enabled: z.boolean(),
        bankName: z.string().trim().max(60).default(""),
        accountType: z.string().trim().max(30).default(""),
        accountNumber: z.string().trim().max(40).default(""),
        holder: z.string().trim().max(120).default(""),
        holderId: z.string().trim().max(30).default(""),
      })
      .default({ enabled: false, bankName: "", accountType: "", accountNumber: "", holder: "", holderId: "" }),
  }),
  shipping: z.object({
    // RF-10.1/10.4: cada transportadora con su tarifa, estado y (RF-09.3) teléfono y URL de rastreo con "{tracking}"
    carriers: z
      .array(
        z.object({
          code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,20}$/, { message: "Código en mayúsculas sin espacios" }),
          name: z.string().trim().max(60),
          enabled: z.boolean(),
          baseCents: Cents,
          perKgCents: Cents,
          etaDays: z.number().int().min(0).max(60),
          phone: z.string().trim().max(30).optional(),
          trackingUrl: z.string().trim().url().max(300).optional().or(z.literal("").transform(() => undefined)),
        })
      )
      .max(10),
    freeShippingOverCents: Cents.nullable().default(null),
    storePickup: z.object({ enabled: z.boolean(), address: z.string().trim().max(160) }).default({ enabled: false, address: "" }), // RF-08.2
  }),
  tax: z.object({ pricesIncludeTax: z.boolean(), rates: z.array(z.object({ region: z.string().trim().max(60), rate: z.number().min(0).max(1) })).max(50) }),
  currency: z.object({ default: z.string().length(3).toUpperCase(), supported: z.array(z.string().length(3).toUpperCase()).min(1).max(10) }),
  // RF-12.6 política de devoluciones: días desde la entrega y si las fotos son obligatorias (RF-12.7)
  returns: z.object({ windowDays: z.number().int().min(1).max(365).default(30), requirePhotos: z.boolean().default(true) }),
  // RF-21.2 centro de ayuda: preguntas frecuentes por categoría + datos de contacto visibles en la tienda
  help: z.object({
    faq: z.array(z.object({ category: z.string().trim().min(2).max(60), question: z.string().trim().min(5).max(200), answer: z.string().trim().min(5).max(3000) })).max(100),
    contactEmail: z.string().email().optional(),
    whatsapp: z.string().trim().max(20).optional(),
    hours: z.string().trim().max(120).optional(),
  }),
} as const;

export type ListContentQuery = z.infer<typeof ListContentQuerySchema>;
export type ContentInput = z.infer<typeof ContentSchema>;
export type UpdateContentInput = z.infer<typeof UpdateContentSchema>;
export type LeadInput = z.infer<typeof LeadSchema>;
export type ListLeadsQuery = z.infer<typeof ListLeadsQuerySchema>;
