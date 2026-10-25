// media.validator.ts (Zod + TypeScript) => reglas del Media Manager, idénticas a las de Express (image.util.ts y
// media.schema.ts): tipos permitidos, 5 MB por imagen / 100 MB por video, 10 imágenes o 3 videos por envío, texto
// alternativo de 1–150 caracteres y metadatos (título, descripción, etiquetas) de RF-26.1 / 26.7.
// Validar en el navegador evita subir megas que el servidor rechazaría (ahorro de red y energía).
// Paradigma funcional (funciones puras); patrones Schema + Strategy (límites por tipo de archivo en tabla).
import { z } from "zod";

// "as const" => tupla readonly: la unión MediaFolder se deriva de aquí (una sola fuente de verdad, DRY)
export const MEDIA_FOLDERS = ["products", "brands", "categories", "collections", "avatars", "reviews", "refunds", "marketing", "email", "suppliers", "ugc", "videos"] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];
export type MediaKind = "image" | "video";

export const MEDIA_ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const; // SVG excluido (scripts)
export const VIDEO_ACCEPT = ["video/mp4", "video/webm", "video/quicktime"] as const; // RF-26.7
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILES = 10;

// LIMITS => Strategy: cada tipo de archivo con sus formatos, peso y cantidad por envío (mismos topes que Multer)
const LIMITS: Record<MediaKind, { accept: readonly string[]; maxBytes: number; maxFiles: number; sizeKey: string }> = {
  image: { accept: MEDIA_ACCEPT, maxBytes: MAX_FILE_BYTES, maxFiles: MAX_FILES, sizeKey: "admin.media.errors.size" },
  video: { accept: VIDEO_ACCEPT, maxBytes: 100 * 1024 * 1024, maxFiles: 3, sizeKey: "admin.media.errors.videoSize" },
};

// kindOf => imagen o video según el MIME (null => no permitido)
export const kindOf = (file: File): MediaKind | null => ((MEDIA_ACCEPT as readonly string[]).includes(file.type) ? "image" : (VIDEO_ACCEPT as readonly string[]).includes(file.type) ? "video" : null);

// validateFiles => separa los archivos válidos de los rechazados; devuelve CLAVES de traducción con el nombre del archivo.
// "kind" => valida solo ese tipo (reemplazo de imagen); sin él acepta ambos y respeta el tope de cada uno
export function validateFiles(files: File[], kind?: MediaKind): { valid: File[]; errors: Array<{ key: string; name: string }> } {
  const errors: Array<{ key: string; name: string }> = [];
  const count: Record<MediaKind, number> = { image: 0, video: 0 };
  // "filter" + efecto acumulado en "errors" (función pura respecto de sus entradas: no muta "files")
  const valid = files.filter((file) => {
    const type = kindOf(file);
    if (!type || (kind && type !== kind)) return errors.push({ key: "admin.media.errors.type", name: file.name }) && false;
    const limit = LIMITS[type];
    if (file.size > limit.maxBytes) return errors.push({ key: limit.sizeKey, name: file.name }) && false;
    if (++count[type] > limit.maxFiles) return errors.push({ key: "admin.media.errors.count", name: file.name }) && false;
    return true;
  });
  return { valid, errors };
}

// altSchema => texto alternativo obligatorio (WCAG 1.1.1 y SEO de imágenes)
export const altSchema = z.object({ alt: z.string().trim().min(1, "validation.required").max(150) });

// metaSchema => RF-26.1 / 26.5 / 26.7 metadatos del archivo; "tags" se escribe separado por comas en un solo campo
export const metaSchema = z.object({
  alt: z.string().trim().max(150),
  title: z.string().trim().max(120),
  description: z.string().trim().max(500),
  tags: z.string().trim().max(400),
  watermark: z.boolean(),
});
export type MetaValues = z.infer<typeof metaSchema>;

// splitTags => "verano, Promo ,," -> ["verano", "promo"] (misma normalización que Express)
export const splitTags = (text: string) => [...new Set(text.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
