// media.model.ts => entidad de dominio "MediaAsset": un archivo (imagen o video) almacenado en Cloudinary.
// No es tabla propia (las URLs se guardan en ProductImage, Brand.logoUrl, etc.); es el Value Object que viaja
// entre repository y service. "readonly" => inmutable: nadie modifica un asset ya subido (paradigma funcional).
// Fase 7: "marketing" (piezas de campañas), "email" (imágenes de plantillas) y "suppliers" (contratos/logos)
// RF-19.11 "ugc" (fotos/videos de clientes) · RF-26.7 "videos" (videos de producto y de marketing)
export const MEDIA_FOLDERS = ["products", "brands", "categories", "collections", "avatars", "reviews", "refunds", "marketing", "email", "suppliers", "ugc", "videos"] as const;
// "(typeof X)[number]" => unión literal derivada del arreglo: una sola fuente de verdad para schema y tipo (DRY)
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];
export type MediaResourceType = "image" | "video";

// Prefijo raíz de todos los assets del proyecto en Cloudinary (aísla este proyecto de otros en la misma cuenta)
export const MEDIA_ROOT = "ecommerce-web3";
// RF-26.5 etiqueta que activa la marca de agua en la URL de entrega (el original no se altera: se puede quitar)
export const WATERMARK_TAG = "watermark";

export interface MediaAsset {
  readonly url: string; // URL de entrega optimizada (f_auto/q_auto)
  readonly publicId: string; // Identificador en Cloudinary (necesario para actualizar y borrar)
  readonly width: number; // Dimensiones reales => next/image reserva espacio y evita CLS
  readonly height: number;
  readonly alt?: string; // "?" => opcional: texto alternativo (WCAG 1.1.1) guardado como metadato del asset
  // RF-26.1 / 26.7 metadatos para la biblioteca: tipo, etiquetas, título/descripción, formato, peso y fecha
  readonly resourceType?: MediaResourceType;
  readonly tags?: readonly string[];
  readonly watermark?: boolean; // RF-26.5 la URL de entrega lleva la marca de agua (etiqueta interna "watermark")
  readonly title?: string;
  readonly description?: string;
  readonly format?: string;
  readonly bytes?: number;
  readonly createdAt?: string;
  readonly duration?: number; // Videos: segundos
  readonly posterUrl?: string; // Videos: fotograma de portada (JPG) para <video poster>
}

// normalizeTags => etiquetas en minúsculas, sin espacios extremos ni repetidas (función pura)
export const normalizeTags = (tags: readonly string[]) => [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 20);

// searchExpression => RF-26.1 consulta de la Search API de Cloudinary (función pura y testeable). Las comillas se
// eliminan del texto del usuario: no puede romper la expresión (inyección de sintaxis)
export function searchExpression(filters: { folder?: string | undefined; tag?: string | undefined; q?: string | undefined; type?: MediaResourceType | undefined }): string {
  const clean = (value: string) => value.replace(/["\\()]/g, "").trim();
  const parts = [`folder:${MEDIA_ROOT}${filters.folder ? `/${clean(filters.folder)}` : "/*"}`];
  if (filters.type) parts.push(`resource_type:${filters.type}`);
  if (filters.tag) parts.push(`tags="${clean(filters.tag).toLowerCase()}"`);
  if (filters.q) {
    const q = clean(filters.q);
    parts.push(`(filename:${q}* OR tags:${q.toLowerCase()} OR context.alt:${q}* OR context.title:${q}*)`);
  }
  return parts.join(" AND ");
}
