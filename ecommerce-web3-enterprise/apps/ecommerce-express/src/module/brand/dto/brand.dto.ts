// brand.dto.ts => contratos de salida del módulo Brand.

export interface BrandDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  story: string | null; // RF-05.1
  country: string | null; // RF-05.1 ISO 3166-1 alfa-2
  isPremium: boolean; // RF-05.3
  isExclusive: boolean; // RF-05.3
  isActive: boolean;
  productCount: number; // "listar marcas con logo y conteo de productos"
}

// BrandStatsDto => RF-05.4 estadísticas de ventas de la marca (pedidos no cancelados)
export interface BrandStatsDto {
  brandId: string;
  orders: number; // Pedidos distintos con productos de la marca
  units: number; // Unidades vendidas
  revenueCents: number; // Ingresos por esas líneas (moneda de la tienda)
  topProducts: Array<{ productName: string; units: number; revenueCents: number }>;
  monthly: Array<{ month: string; revenueCents: number; units: number }>; // Últimos 12 meses ("2026-10")
}

// BrandDetailDto => "marca con productos asociados por ID" (tarjetas resumidas de productos activos)
export interface BrandDetailDto extends BrandDto {
  products: Array<{ id: string; name: string; slug: string; minPriceCents: number; imageUrl: string | null }>;
}
