// dashboard.validator.ts => schemas Zod de los formularios del panel admin (mismas reglas que los schemas de Express:
// el usuario ve el error antes de enviar y el backend vuelve a validar). Los mensajes son CLAVES de traducción
// ("validation.required") que Input traduce al idioma actual. Paradigma funcional/declarativo; patrón Schema.
import { z } from "zod";

const text = (min = 1, max = 200) => z.string().trim().min(min, min >= 3 ? "validation.min3" : "validation.required").max(max);
const optionalText = (max = 200) => z.string().trim().max(max).optional().transform((value) => value || undefined); // "" => sin valor
// money => el formulario pide pesos (con decimales) y la API recibe la unidad mínima (centavos): 12.500 -> 1.250.000
const money = z.coerce.number({ invalid_type_error: "validation.required" }).min(0, "validation.positive").transform((value) => Math.round(value * 100));
const integer = (min = 0) => z.coerce.number({ invalid_type_error: "validation.required" }).int().min(min, "validation.positive");

// --- Pedidos / Envíos / Facturas / Devoluciones ("as const" => tuplas readonly: tipos y opciones de los selects) ---
export const ORDER_STATUSES = ["CONFIRMED", "PREPARING", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
export const SHIPMENT_STATUSES = ["PENDING", "LABEL_CREATED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"] as const;
export const REFUND_STATUSES = ["REQUESTED", "APPROVED", "REJECTED", "PROCESSED", "CANCELLED"] as const;
export const orderStatusSchema = z.object({ status: z.enum(ORDER_STATUSES), note: optionalText(500) });
export const shipmentUpdateSchema = z.object({ status: z.enum(SHIPMENT_STATUSES), description: optionalText(300), location: optionalText(120) });
// approve llega del <select> como texto "true"/"false" y se convierte a booleano (lo que espera PATCH /refund/:id/approve)
export const refundReviewSchema = z.object({ approve: z.enum(["true", "false"]).transform((value) => value === "true"), note: optionalText(500) });
// manualOrderSchema => "Nuevo pedido" del ADMIN (POST /order/manual). Ítems por SKU + cantidad; dirección de envío
// igual que la del checkout; el costo de envío se escribe en pesos y viaja en centavos (money). Express recalcula
// precios e IVA con el catálogo vigente: el formulario nunca envía precios (no se pueden manipular desde el navegador).
export const manualOrderSchema = z.object({
  customerEmail: z.string().trim().email("validation.emailInvalid"),
  items: z.array(z.object({ sku: text(1, 80), quantity: integer(1) })).min(1, "validation.required"),
  shippingAddress: z.object({
    recipientName: text(2, 120),
    phone: text(3, 20),
    line1: text(3, 200),
    line2: optionalText(200).transform((value) => value ?? null),
    city: text(2, 80),
    state: text(2, 80),
    postalCode: text(3, 12),
    country: z.string().trim().length(2, "validation.country").toUpperCase(),
  }),
  shippingCents: money,
  note: optionalText(500),
});
export type ManualOrderValues = z.input<typeof manualOrderSchema>;

export const invoiceSchema = z.object({ orderId: z.string().trim().uuid("validation.uuid") });
export const creditNoteSchema = z.object({ amount: money, reason: text(5, 300) });

// --- Inventario ---
export const stockAdjustSchema = z.object({ stock: integer(0), reason: text(3) });
export const movementSchema = z.object({
  type: z.enum(["IN", "OUT", "RETURN", "DAMAGE"]),
  quantity: integer(1),
  reason: text(3),
  reference: optionalText(100),
});

// --- Proveedores ---
export const supplierSchema = z.object({
  name: text(2, 150),
  taxId: z.string().trim().regex(/^[0-9A-Za-z.-]{5,20}$/, "validation.taxId"),
  email: z.string().trim().email("validation.emailInvalid"),
  phone: optionalText(20),
  contactName: optionalText(120),
  paymentTermsDays: integer(0),
  leadTimeDays: integer(0),
  rating: z.union([z.literal(""), z.coerce.number().min(0, "validation.rating").max(5, "validation.rating")]).transform((value) => (value === "" ? undefined : value)),
  contractEndsAt: optionalText(10),
});

// --- CRM ---
export const customerSchema = z.object({
  email: z.string().trim().email("validation.emailInvalid"),
  firstName: text(1, 80),
  lastName: text(1, 80),
  phone: optionalText(20),
  tags: z.string().default("").transform((value) => value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean)),
  note: optionalText(1000),
});
export const customerUpdateSchema = z.object({
  tags: z.string().default("").transform((value) => value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean)),
  score: z.union([z.literal(""), z.coerce.number().int().min(0, "validation.score").max(100, "validation.score")]).transform((value) => (value === "" ? null : value)),
  note: optionalText(1000),
});

// --- Marketing / Email / Cupones ---
export const campaignSchema = z.object({
  name: text(3, 120),
  channel: z.enum(["EMAIL", "PUSH", "WHATSAPP"]),
  // Segmentos automáticos o personalizados "SEGMENT:<id>" (RF-22.2)
  audience: z.string().regex(/^(ALL|VIP|REGULAR|NEW|INACTIVE|SEGMENT:[a-f0-9]{24})$/i, "validation.required"),
  subject: text(1, 200),
  content: text(1, 100_000),
  scheduledAt: optionalText(30),
  cost: money.default(0), // RF-24.3 inversión (pesos -> centavos)
  // RF-21.4 prueba A/B (solo correo)
  abEnabled: z.boolean().default(false),
  subjectB: optionalText(200),
  contentB: optionalText(100_000),
  testPercent: z.coerce.number().int().min(10).max(50).default(20),
  abMetric: z.enum(["OPEN", "CLICK"]).default("OPEN"),
  waitHours: z.coerce.number().int().min(1).max(72).default(4),
});
export const templateSchema = z.object({ name: text(3, 120), subject: text(1, 200), html: text(1, 100_000) });
export const sendEmailSchema = z.object({
  to: z.string().trim().email("validation.emailInvalid"),
  templateId: z.string().min(1, "validation.required"),
  variables: z
    .string()
    .default("")
    // "nombre=Ana, codigo=X1" -> { nombre: "Ana", codigo: "X1" }
    .transform((value) => Object.fromEntries(value.split(",").map((pair) => pair.split("=").map((part) => part.trim())).filter(([key, item]) => key && item !== undefined))),
});
export const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, "validation.couponCode"),
  type: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"]),
  value: integer(0),
  usageLimit: z.union([z.literal(""), z.coerce.number().int().min(1)]).transform((value) => (value === "" ? null : value)),
  endsAt: optionalText(10),
  // RF-13.2 alcance del cupón (vacío = sin restricción)
  productIds: z.array(z.string()).default([]),
  categoryIds: z.array(z.string()).default([]),
  brandIds: z.array(z.string()).default([]),
  segments: z.array(z.enum(["BRONZE", "SILVER", "GOLD", "DIAMOND", "PLATINUM"])).default([]),
});

// promotionSchema => RF-13.4/13.7/13.8 promoción automática (fechas locales -> ISO en el toBody)
export const promotionSchema = z.object({
  name: text(3, 120),
  type: z.enum(["BUY_X_PAY_Y", "PERCENT_OFF", "TIERED", "FLASH"]),
  buyQuantity: z.union([z.literal(""), z.coerce.number().int().min(2).max(10)]).transform((value) => (value === "" ? null : value)),
  payQuantity: z.union([z.literal(""), z.coerce.number().int().min(1).max(9)]).transform((value) => (value === "" ? null : value)),
  percent: z.union([z.literal(""), z.coerce.number().int().min(1).max(90)]).transform((value) => (value === "" ? null : value)),
  tiers: optionalText(200), // "2:10, 4:20" => lleva 2 o más: 10 %, 4 o más: 20 %
  categoryIds: z.array(z.string()).default([]),
  brandIds: z.array(z.string()).default([]),
  collectionIds: z.array(z.string()).default([]),
  priority: z.coerce.number().int().min(0).max(1000).default(0),
  stackable: z.boolean().default(false),
  startsAt: text(10, 20),
  endsAt: text(10, 20),
});

// multiplierSchema => RF-14.9 evento de puntos multiplicados
export const multiplierSchema = z.object({ name: text(3, 120), multiplier: z.coerce.number().min(1.1).max(10), startsAt: text(10, 20), endsAt: text(10, 20) });

// resolutionSchema => RF-11.3 resolución de facturación DIAN
export const resolutionSchema = z.object({
  resolutionNumber: z.string().trim().regex(/^\d{6,30}$/, "validation.required"),
  prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,10}$/, "validation.required"),
  fromNumber: integer(1),
  toNumber: integer(1),
  technicalKey: text(10, 100),
  validFrom: text(10, 10),
  validTo: text(10, 10),
});
export const voidInvoiceSchema = z.object({ reason: text(5, 300) });

// RF-12 logística inversa e inspección
export const returnStatusSchema = z.object({ status: z.enum(["IN_TRANSIT", "RECEIVED"]) });
export const inspectionSchema = z.object({ passed: z.enum(["true", "false"]).transform((value) => value === "true"), notes: text(3, 1000), photoUrls: text(10, 2000) });

// --- Productos ---
// Imágenes del producto: subidas a Cloudinary por MediaUploader; el texto alternativo es obligatorio (WCAG 1.1.1 + SEO)
export const productImageSchema = z.object({
  url: z.string().url(),
  publicId: z.string().min(1),
  alt: text(1, 160),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const variantSchema = z.object({
  sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,40}$/, "validation.sku"),
  name: text(1, 80),
  price: money,
  stock: integer(0),
});
// RF-04.2 insignias comerciales (mismo enum ProductBadge de Express/Prisma)
export const PRODUCT_BADGES = ["NEW", "SALE", "BEST_SELLER"] as const;
export const productSchema = z.object({
  name: text(2, 160),
  description: z.string().trim().min(10, "validation.description").max(10_000),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  categoryId: optionalText(40),
  brandId: optionalText(40),
  badges: z.array(z.enum(PRODUCT_BADGES)).default([]),
  preSaleUntil: optionalText(10), // RF-14.4 "YYYY-MM-DD": preventa exclusiva hasta ese día
  variants: z.array(variantSchema).min(1, "validation.required"),
  images: z.array(productImageSchema).max(20),
});

// --- Configuración ---
export const webhookSchema = z.object({
  name: text(3, 120),
  url: z.string().trim().url("validation.url"),
  events: z.array(z.string()).min(1, "validation.required"),
  maxAttempts: integer(1),
  active: z.boolean(),
});
export const roleSchema = z.object({
  name: z.string().trim().regex(/^[A-Z_]+$/, "validation.roleName"),
  description: optionalText(200),
  permissionIds: z.array(z.string()).default([]), // Casillas del formulario => IDs de permisos asignados al rol
  parentId: optionalText(40).transform((value) => value ?? null), // RF-03.1 "" => rol raíz (null en Express)
});
export const PERMISSION_ACTIONS = ["CREATE", "READ", "UPDATE", "DELETE"] as const;
export const permissionSchema = z.object({
  action: z.enum(PERMISSION_ACTIONS),
  resource: z.string().trim().regex(/^[a-z_]+$/, "validation.resource"),
  description: optionalText(200),
});
export const permissionUpdateSchema = z.object({ description: text(1, 200) });
// Automatización n8n: el evento es obligatorio solo si el disparador es EVENT (misma regla que automation.schema.ts)
export const TRIGGER_TYPES = ["EVENT", "MANUAL", "SCHEDULE", "WEBHOOK"] as const;
export const workflowSchema = z
  .object({
    name: text(3, 120),
    description: optionalText(500),
    triggerType: z.enum(TRIGGER_TYPES),
    event: optionalText(60),
    webhookPath: z.string().trim().regex(/^[\w-]+(\/[\w-]+)*$/, "validation.webhookPath").max(120),
    active: z.boolean(),
  })
  .refine((value) => value.triggerType !== "EVENT" || value.event !== undefined, { message: "validation.required", path: ["event"] });
// MCP: motivo del rollback manual de una transacción Saga
export const rollbackSchema = z.object({ reason: text(3, 200) });

// --- Catálogo: categorías, marcas, colecciones y reseñas ---
const optionalUrl = z.string().trim().url("validation.url").optional().or(z.literal("").transform(() => undefined));
const optionalDate = z.string().optional().transform((value) => (value ? new Date(value).toISOString() : undefined));
export const categorySchema = z.object({
  name: text(2, 80),
  description: optionalText(1000),
  imageUrl: optionalUrl,
  parentId: optionalText(40).transform((value) => value ?? null), // "" => categoría raíz (null en Express)
  isActive: z.boolean(),
});
export const brandSchema = z.object({
  name: text(2, 80),
  description: optionalText(1000),
  story: optionalText(5000), // RF-05.1
  country: z.string().trim().toUpperCase().regex(/^([A-Z]{2})?$/, "validation.country").transform((value) => value || undefined), // RF-05.1 ISO alfa-2
  website: optionalUrl,
  logoUrl: optionalUrl,
  isPremium: z.boolean(), // RF-05.3
  isExclusive: z.boolean(), // RF-05.3
  isActive: z.boolean(),
});
// productBulkSchema => RF-04.3 edición en lote: "" en un select = no cambiar ese campo
export const productBulkSchema = z.object({
  status: z.union([z.literal(""), z.enum(["DRAFT", "ACTIVE", "ARCHIVED"])]),
  categoryId: z.string(),
  brandId: z.string(),
  badges: z.array(z.enum(PRODUCT_BADGES)),
  replaceBadges: z.boolean(), // Sin marcar => las insignias no se tocan
});
export const collectionSchema = z.object({ name: text(2, 120), description: optionalText(2000), imageUrl: optionalUrl, startsAt: optionalDate, endsAt: optionalDate, isActive: z.boolean() });
export const REVIEW_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export const reviewModerationSchema = z.object({ status: z.enum(REVIEW_STATUSES), moderationNote: optionalText(300) });
export const reviewReplySchema = z.object({ vendorReply: text(3, 1500) });

// --- Usuarios: perfil + roles (dos peticiones en Express: PATCH /user/:id y PATCH /user/:id/roles) ---
export const userSchema = z.object({
  firstName: text(1, 80),
  lastName: text(1, 80),
  phone: z.string().trim().regex(/^((\+57)?3\d{9})?$/, "validation.colombianMobile").transform((value) => value || null),
  roles: z.array(z.string()).min(1, "validation.required"),
});

export type ProductFormValues = z.input<typeof productSchema>;
export type ProductPayload = z.output<typeof productSchema>;
