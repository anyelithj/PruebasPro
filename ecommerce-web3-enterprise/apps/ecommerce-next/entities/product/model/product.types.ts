// product.types.ts (capa entities de FSD) => forma SERIALIZADA (JSON) de los productos que entrega la API.
// Difiere de los DTO del backend en que las fechas llegan como string ISO (JSON no tiene tipo Date).
import type { Ref } from "@/shared/types/common.types";

export interface ProductCard {
  id: string;
  name: string;
  slug: string;
  status: string;
  currency: string;
  minPriceCents: number;
  maxPriceCents: number;
  compareAtPriceCents: number | null;
  ratingAvg: number;
  ratingCount: number;
  imageUrl: string | null;
  imageAlt: string | null;
  inStock: boolean;
  badges: Array<"NEW" | "SALE" | "BEST_SELLER">; // RF-04.2 insignias comerciales
  brand: Ref | null;
  category: Ref | null;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  priceCents: number;
  compareAtPriceCents: number | null;
  available: number;
  weightGrams: number;
  isActive: boolean;
}

export interface ProductImageData {
  id: string;
  url: string;
  publicId: string; // ID de Cloudinary (el panel admin lo reenvía al editar las imágenes del producto)
  alt: string;
  width: number | null;
  height: number | null;
  position: number;
  variantId: string | null;
}

// "Omit" => el detalle reutiliza la tarjeta sin los campos de imagen única (DRY)
export interface ProductDetail extends Omit<ProductCard, "imageUrl" | "imageAlt"> {
  description: string;
  preSaleUntil?: string | null; // RF-14.4 preventa exclusiva (ISO)
  vendorId: string | null;
  variants: ProductVariant[];
  images: ProductImageData[];
  collections: Ref[];
  createdAt: string;
  updatedAt: string;
}

export interface CategoryNode extends Ref {
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  productCount: number;
  children: CategoryNode[];
}

export interface CategoryDetail extends CategoryNode {
  breadcrumb: Ref[];
}

export interface Brand extends Ref {
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  story: string | null; // RF-05.1
  country: string | null; // RF-05.1 ISO 3166-1 alfa-2
  isPremium: boolean; // RF-05.3
  isExclusive: boolean; // RF-05.3
  isActive: boolean;
  productCount: number;
}

// BrandStats => RF-05.4 ventas por marca (GET /brand/:id/stats, solo ADMIN)
export interface BrandStats {
  brandId: string;
  orders: number;
  units: number;
  revenueCents: number;
  topProducts: Array<{ productName: string; units: number; revenueCents: number }>;
  monthly: Array<{ month: string; units: number; revenueCents: number }>;
}

export interface CollectionSummary extends Ref {
  description: string | null;
  imageUrl: string | null;
  productCount: number;
}
