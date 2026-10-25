// help.validator.ts (Zod) => RF-21.2 contratos del centro de ayuda: formulario de contacto (mismas reglas que
// ContactSchema de Express) y configuración de preguntas frecuentes (sección "help" de /cms/config).
// Mensajes = claves i18n. Paradigma declarativo. Funciones puras de búsqueda y agrupación (testeables).
import { z } from "zod";

export const CONTACT_TOPICS = ["ORDER", "PRODUCT", "RETURN", "PAYMENT", "OTHER"] as const;

export const contactSchema = z.object({
  name: z.string().trim().min(2, "validation.required").max(120),
  email: z.string().trim().email("validation.email"),
  phone: z.string().trim().max(30).optional(),
  topic: z.enum(CONTACT_TOPICS),
  orderNumber: z.string().trim().max(40).optional(),
  message: z.string().trim().min(10, "validation.min10").max(5000),
  website: z.string().max(200).optional(), // Honeypot invisible: las personas lo dejan vacío
});
export type ContactValues = z.output<typeof contactSchema>;

export interface FaqItem {
  category: string;
  question: string;
  answer: string;
}
export interface HelpConfig {
  faq: FaqItem[];
  contactEmail?: string;
  whatsapp?: string;
  hours?: string;
}

// helpSchema => editor del panel (Nuxt config): lista dinámica de preguntas + datos de contacto
export const helpSchema = z.object({
  faq: z.array(z.object({ category: z.string().trim().min(2, "validation.required").max(60), question: z.string().trim().min(5, "validation.required").max(200), answer: z.string().trim().min(5, "validation.required").max(3000) })).max(100),
  contactEmail: z.union([z.literal(""), z.string().trim().email("validation.email")]).transform((v) => v || undefined),
  whatsapp: z.string().trim().max(20).transform((v) => v || undefined),
  hours: z.string().trim().max(120).transform((v) => v || undefined),
});

// normalize => sin tildes ni mayúsculas (la búsqueda encuentra "envio" en "Envío")
const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// searchFaq => filtra por todas las palabras de la búsqueda en pregunta o respuesta; agrupa por categoría
export function searchFaq(items: FaqItem[], query: string): Array<{ category: string; items: FaqItem[] }> {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const matches = items.filter((item) => words.every((word) => normalize(`${item.question} ${item.answer}`).includes(word)));
  const groups = new Map<string, FaqItem[]>();
  for (const item of matches) groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
  return [...groups].map(([category, list]) => ({ category, items: list }));
}
