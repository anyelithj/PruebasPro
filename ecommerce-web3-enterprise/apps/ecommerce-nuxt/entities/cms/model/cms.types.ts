// cms.types.ts (TypeScript estricto, Value Objects) => forma JSON del módulo CMS de Express (cms.dto.ts): páginas,
// landings, lookbooks y eventos comparten la misma estructura base (Single Table Inheritance por "kind").
// Fechas como string ISO (así llegan por JSON).
import type { Media } from "~~/shared/types/common.types";

export type ContentKind = "page" | "landing" | "lookbook" | "event";
export type ContentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

// Hotspot => producto etiquetado sobre una foto del lookbook (posición en % para que sea responsive)
export interface Hotspot {
  productId: string;
  x: number;
  y: number;
}

export interface CmsMedia extends Media {
  hotspots: Hotspot[];
}

// CmsContentSummary => tarjeta de listado (sin cuerpo HTML: respuestas livianas)
export interface CmsContentSummary<D = Record<string, unknown>> {
  id: string;
  kind: ContentKind;
  slug: string;
  title: string;
  summary: string;
  locale: "es" | "en";
  status: ContentStatus;
  coverUrl: string | null;
  coverAlt: string | null;
  data: D;
  publishedAt: string | null;
  updatedAt: string;
}

// CmsContent => documento completo (detalle público y editor)
export interface CmsContent<D = Record<string, unknown>> extends Omit<CmsContentSummary<D>, "coverUrl" | "coverAlt"> {
  seo: { title: string | null; description: string | null; imageUrl: string | null };
  body: { html: string; css: string; project: Record<string, unknown> | null };
  media: CmsMedia[];
  productIds: string[];
  createdAt: string;
}

// CmsBlock => bloque reutilizable del editor GrapesJS (Factory: useCMSBlocks los genera)
export interface CmsBlock {
  id: string;
  label: string;
  category: string;
  content: string; // HTML con clases de Tailwind
}

// Colección del catálogo (Express /collection, PostgreSQL): la vista CMS la presenta como banner + productos
export interface CatalogCollection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  lookDiscountPercent: number | null; // RF-05.5 % de descuento al llevar el look completo
  isActive: boolean;
  productCount: number;
  products?: Array<{ id: string; name: string; slug: string; imageUrl: string | null; minPriceCents: number; position: number }>;
}
