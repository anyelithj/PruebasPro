// product.types.ts => tipos internos del módulo Product (compartidos entre service y repository).
import type { ListProductsQuery } from "../schema/product.schema";

// ProductViewer => quién consulta: define visibilidad (el público solo ve ACTIVE; el vendedor ve sus borradores)
export interface ProductViewer {
  id: string;
  roles: string[];
}

// ProductFilter => filtros ya RESUELTOS (slugs convertidos a IDs, árbol de categorías expandido)
export interface ProductFilter {
  q?: string | undefined;
  categoryIds?: string[] | undefined;
  brandId?: string | undefined;
  collectionSlug?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  inStock?: boolean | undefined;
  badge?: "NEW" | "SALE" | "BEST_SELLER" | undefined; // RF-04.2
  statuses: Array<"DRAFT" | "ACTIVE" | "ARCHIVED">;
  vendorId?: string | undefined;
  sort: ListProductsQuery["sort"];
}

// ImportResult => RF-04.3 resumen de una importación masiva (qué se creó, actualizó y qué filas fallaron y por qué)
export interface ImportResult {
  created: number;
  updated: number;
  errors: Array<{ rows: number[]; slug: string; message: string }>;
}
