// search.dto.ts => contratos de salida del módulo Search (SearchResults + SearchFilters facetados en Next.js).
import type { ProductListItemDto } from "../../product/dto/product.dto";
import type { PaginationMeta } from "../../../shared/types/pagination.types";

export interface FacetBucket {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export interface SearchFacetsDto {
  categories: FacetBucket[];
  brands: FacetBucket[];
  price: { min: number; max: number };
  // "Record<clave, valores>" => { size: [{ value: "M", count: 12 }], color: [...] }
  attributes: Record<string, Array<{ value: string; count: number }>>;
}

export interface SearchResultDto {
  query: string;
  didYouMean: string | null; // RF-06.1: corrección sugerida cuando la búsqueda no encontró nada
  items: ProductListItemDto[];
  facets: SearchFacetsDto;
  meta: PaginationMeta;
}

export interface SuggestionDto {
  type: "product" | "category" | "brand";
  label: string;
  slug: string;
}

// VisualAttributesDto => RF-06.4 lo que el motor de visión reconoció en la foto (colores, patrón, textura y marca/logo)
export interface VisualAttributesDto {
  colors: Array<{ name: string; hex: string; share: number }>; // share = fracción de la imagen (0-1)
  patterns: Array<{ label: string; score: number }>;
  textures: Array<{ label: string; score: number }>;
  brands: Array<{ label: string; score: number }>; // Logos de marcas del catálogo detectados
}

export interface ImageSearchResultDto {
  items: Array<ProductListItemDto & { similarity: number }>;
  attributes: VisualAttributesDto | null; // null si el motor no devolvió atributos (versión anterior)
}
