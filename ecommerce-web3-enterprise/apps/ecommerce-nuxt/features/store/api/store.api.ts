// store.api.ts => Repository del catálogo de la tienda contra Express (REST): listado con filtros, ficha, árbol de
// categorías y saldo de fidelidad. Inyección del cliente "api" (anónimo en páginas públicas con caché).
import type { Api } from "~~/shared/lib/api-client";
import type { Query } from "~~/shared/types/api.types";
import type { CategoryNode } from "~~/entities/blog/model/blog.types";
import type { ProductDetail, StoreBrand, StoreProduct } from "~~/entities/product/model/product.types";

export const PRODUCT_SORTS = ["newest", "price_asc", "price_desc", "rating"] as const;

export function storeApi(api: Api) {
  return {
    // products => GET /product?q=&category=&collection=&sort=&page=&limit=
    products: (query: Query) => api.get<StoreProduct[]>("/product", query),
    // spelling => GET /search/spelling?q= (RF-06.1 corrección ortográfica)
    spelling: (q: string) => api.get<{ query: string; suggestion: string | null }>("/search/spelling", { q }),
    product: async (slug: string) => (await api.get<ProductDetail>(`/product/${encodeURIComponent(slug)}`)).data,
    categories: async () => (await api.get<CategoryNode[]>("/category")).data,
    loyalty: async () => (await api.get<{ pointsBalance: number; tier: string }>("/loyalty/me")).data,
    // RF-05 marcas: listado (premium primero) y landing por slug
    brands: async () => (await api.get<StoreBrand[]>("/brand", { limit: 100 })).data,
    brand: async (slug: string) => (await api.get<StoreBrand>(`/brand/${encodeURIComponent(slug)}`)).data,
  };
}
