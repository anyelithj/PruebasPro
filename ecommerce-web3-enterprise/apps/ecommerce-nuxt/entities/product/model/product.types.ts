// product.types.ts (entities) => forma JSON del catálogo que entrega Express (/product y /product/:slug): mismo DTO
// que usaba la tienda Next.js. Las fechas llegan como string ISO.
import type { EntityRef } from "~~/shared/types/common.types";

export interface StoreProduct {
  id: string;
  name: string;
  slug: string;
  currency: string;
  minPriceCents: number;
  maxPriceCents: number;
  compareAtPriceCents: number | null;
  ratingAvg: number;
  ratingCount: number;
  imageUrl: string | null;
  imageAlt: string | null;
  inStock: boolean;
  badges: ProductBadge[]; // RF-04.2 insignias comerciales
  brand: EntityRef | null;
  category: EntityRef | null;
}

// RF-04.2 insignias (mismo enum ProductBadge de Express/Prisma). "as const" => tupla de literales de solo lectura
export const PRODUCT_BADGES = ["NEW", "SALE", "BEST_SELLER"] as const;
export type ProductBadge = (typeof PRODUCT_BADGES)[number]; // Tipo indexado: "NEW" | "SALE" | "BEST_SELLER"

// StoreBrand => RF-05.1/05.3 marca pública (GET /brand y /brand/:slug)
export interface StoreBrand extends EntityRef {
  description: string | null;
  story: string | null;
  country: string | null; // ISO 3166-1 alfa-2
  logoUrl: string | null;
  website: string | null;
  isPremium: boolean;
  isExclusive: boolean;
  productCount: number;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, string>; // { size: "38", color: "negro" }
  priceCents: number;
  compareAtPriceCents: number | null;
  available: number;
  isActive: boolean;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

export interface ProductDetail extends Omit<StoreProduct, "imageUrl" | "imageAlt"> {
  description: string;
  preSaleUntil?: string | null; // RF-14.4 preventa exclusiva (ISO) para Diamante y Platino
  variants: ProductVariant[];
  images: ProductImage[];
}

// discountPercent => % de descuento frente al precio anterior; null si no hay rebaja (función pura)
export const discountPercent = (price: number, compareAt: number | null | undefined) => (compareAt && compareAt > price ? Math.round((1 - price / compareAt) * 100) : null);
