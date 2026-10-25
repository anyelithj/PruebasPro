// seo.api.ts => Repository de las secciones SEO contra Express: árbol y detalle de categorías (/category), productos
// de una categoría (/product?category=) y eventos publicados (/cms/event). El blog NO pasa por aquí: vive en archivos
// MDC de Nuxt Content (0 peticiones a Express). Inyección del cliente "api".
import type { Api } from "~~/shared/lib/api-client";
import type { Query } from "~~/shared/types/api.types";
import type { ProductCard } from "~~/shared/types/common.types";
import type { CategoryDetail, CategoryNode, SeoEvent, SeoEventSummary } from "~~/entities/blog/model/blog.types";

export function seoApi(api: Api) {
  return {
    categories: async () => (await api.get<CategoryNode[]>("/category")).data,
    category: async (slug: string) => (await api.get<CategoryDetail>(`/category/${slug}`)).data,
    categoryProducts: (slug: string, page = 1) => api.get<ProductCard[]>("/product", { category: slug, page, limit: 12 }),
    events: (query: Query = {}) => api.get<SeoEventSummary[]>("/cms/event", query),
    event: async (slug: string) => (await api.get<SeoEvent>(`/cms/event/${slug}`)).data,
  };
}
