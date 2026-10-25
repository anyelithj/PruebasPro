// common.types.ts => tipos de dominio reutilizados por varias features (Value Objects inmutables con "readonly").
export type Locale = "es" | "en";

// EntityRef => referencia mínima a otra entidad (categoría, marca, colección): id + nombre + slug para enlaces SEO
export interface EntityRef {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

// Option => opción de <select> o filtro (value técnico + label traducido)
export interface Option {
  readonly value: string;
  readonly label: string;
}

// Media => imagen de Cloudinary con texto alternativo obligatorio (WCAG 1.1.1) y dimensiones (evita CLS)
export interface Media {
  url: string;
  publicId?: string | null;
  alt: string;
  width?: number | null;
  height?: number | null;
}

// Column => columna declarativa de shared/ui/DataTable.vue (Composite: columnas como datos)
export interface Column {
  key: string;
  label: string;
  class?: string;
}

// ProductCard => tarjeta de producto que devuelve Express (/product, /social): mismo DTO que la tienda Next.js
export interface ProductCard {
  id: string;
  name: string;
  slug: string;
  currency: string;
  minPriceCents: number;
  imageUrl: string | null;
  imageAlt: string | null;
  inStock: boolean;
}
