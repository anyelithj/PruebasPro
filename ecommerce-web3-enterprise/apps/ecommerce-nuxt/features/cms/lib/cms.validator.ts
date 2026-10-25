// cms.validator.ts (Zod) => schemas de los formularios del CMS (mismas reglas que cms.schema.ts y collection.schema.ts
// de Express: el usuario ve el error antes de enviar y el backend vuelve a validar). Los mensajes son CLAVES de i18n
// que shared/ui/Input.vue traduce. Paradigma funcional/declarativo; patrón Schema + Strategy (data por tipo).
import { z } from "zod";

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "validation.slug").max(120);
const optional = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined); // "" => sin valor
const optionalDate = z.string().optional().transform((value) => (value ? new Date(value).toISOString() : undefined));

// slugify => "Black Friday 2026" -> "black-friday-2026" (función pura; normaliza tildes con NFD)
export const slugify = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);

// Campos comunes de páginas, landings, lookbooks y eventos
export const contentSchema = z.object({
  kind: z.enum(["page", "landing", "lookbook", "event"]),
  title: z.string().trim().min(3, "validation.min3").max(160),
  slug,
  summary: z.string().trim().max(500).default(""),
  locale: z.enum(["es", "en"]),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  seoTitle: optional(70),
  seoDescription: optional(160),
  // Landing
  headline: optional(160),
  ctaLabel: optional(60),
  ctaUrl: optional(300),
  couponCode: optional(30),
  endsAt: optionalDate,
  // Evento
  startsAt: optionalDate,
  eventEndsAt: optionalDate,
  location: optional(200),
  online: z.boolean().default(true),
  eventUrl: z.string().trim().url("validation.url").optional().or(z.literal("").transform(() => undefined)),
  // Lookbook
  season: optional(60),
}).superRefine((value, ctx) => {
  // Strategy por tipo: un evento necesita fechas válidas (misma regla que Express)
  if (value.kind !== "event") return;
  if (!value.startsAt) ctx.addIssue({ code: "custom", message: "validation.required", path: ["startsAt"] });
  if (!value.eventEndsAt || (value.startsAt && value.eventEndsAt <= value.startsAt)) ctx.addIssue({ code: "custom", message: "validation.endAfterStart", path: ["eventEndsAt"] });
});
export type ContentForm = z.input<typeof contentSchema>;
export type ContentValues = z.output<typeof contentSchema>;

// toData => valores del formulario -> "data" propio del tipo que espera Express (Adapter)
export function toData(values: ContentValues): Record<string, unknown> {
  if (values.kind === "landing") return { headline: values.headline, ctaLabel: values.ctaLabel, ctaUrl: values.ctaUrl, couponCode: values.couponCode, endsAt: values.endsAt };
  if (values.kind === "event") return { startsAt: values.startsAt, endsAt: values.eventEndsAt, location: values.location ?? "Online", online: values.online, url: values.eventUrl };
  if (values.kind === "lookbook") return { season: values.season };
  return {};
}

// Colección del catálogo (Express /collection)
export const collectionSchema = z
  .object({
    name: z.string().trim().min(2, "validation.required").max(120),
    slug,
    description: optional(2000),
    imageUrl: z.string().trim().url("validation.url").optional().or(z.literal("").transform(() => undefined)),
    startsAt: optionalDate,
    endsAt: optionalDate,
    // RF-05.5 descuento por look completo (1-90 %); vacío => sin descuento (null en Express)
    lookDiscountPercent: z.union([z.literal("").transform(() => null), z.coerce.number().int().min(1, "validation.lookDiscount").max(90, "validation.lookDiscount")]).nullable().optional(),
    isActive: z.boolean(),
  })
  .refine((value) => !value.startsAt || !value.endsAt || value.endsAt > value.startsAt, { message: "validation.endAfterStart", path: ["endsAt"] });
export type CollectionForm = z.input<typeof collectionSchema>;

// Texto alternativo de una imagen subida (obligatorio: WCAG 1.1.1)
export const altSchema = z.string().trim().min(1, "validation.required").max(160);
