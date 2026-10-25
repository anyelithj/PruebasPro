// cms.api.ts ($fetch vía shared/lib/api-client) => Repository del CMS contra Express: contenido por tipo
// (/cms/:kind), colecciones del catálogo (/collection), búsqueda de productos (/product) y subida de imágenes a
// Cloudinary (/media/upload). Inyección de dependencias: recibe el cliente "api" (testeable, sin estado global).
import type { Api } from "~~/shared/lib/api-client";
import type { Query } from "~~/shared/types/api.types";
import type { ProductCard } from "~~/shared/types/common.types";
import type { CatalogCollection, CmsContent, CmsContentSummary, CmsMedia, ContentKind } from "~~/entities/cms/model/cms.types";

// ContentPayload => lo que se envía al crear/editar (mismo contrato que ContentSchema de Express)
export interface ContentPayload {
  slug: string;
  title: string;
  summary: string;
  locale: "es" | "en";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  seo: { title?: string | undefined; description?: string | undefined; imageUrl?: string | null };
  body?: { html: string; css: string; project: Record<string, unknown> | null };
  media?: CmsMedia[];
  productIds?: string[];
  data: Record<string, unknown>;
}

export function cmsApi(api: Api) {
  return {
    // ---------- Contenido (page | landing | lookbook | event) ----------
    list: <D = Record<string, unknown>>(kind: ContentKind, query: Query = {}) => api.get<Array<CmsContentSummary<D>>>(`/cms/${kind}`, query),
    get: async <D = Record<string, unknown>>(kind: ContentKind, slug: string) => (await api.get<CmsContent<D>>(`/cms/${kind}/${slug}`)).data,
    create: async (kind: ContentKind, payload: ContentPayload) => (await api.post<CmsContent>(`/cms/${kind}`, payload)).data,
    update: async (kind: ContentKind, id: string, payload: Partial<ContentPayload>) => (await api.patch<CmsContent>(`/cms/${kind}/${id}`, payload)).data,
    archive: (kind: ContentKind, id: string) => api.del(`/cms/${kind}/${id}`),

    // ---------- Colecciones del catálogo ----------
    collections: (query: Query = {}) => api.get<CatalogCollection[]>("/collection", query),
    collection: async (idOrSlug: string) => (await api.get<CatalogCollection>(`/collection/${idOrSlug}`)).data,
    createCollection: async (payload: Record<string, unknown>) => (await api.post<CatalogCollection>("/collection", payload)).data,
    updateCollection: async (id: string, payload: Record<string, unknown>) => (await api.patch<CatalogCollection>(`/collection/${id}`, payload)).data,
    deleteCollection: (id: string) => api.del(`/collection/${id}`),

    // ---------- Productos y medios ----------
    searchProducts: async (q: string) => (await api.get<ProductCard[]>("/product", { q, limit: 12 })).data,
    // uploadImage => multipart a Cloudinary vía Express (Sharp optimiza; carpeta "marketing" del Media Manager)
    uploadImage: async (file: File) => {
      const form = new FormData();
      form.append("files", file);
      form.append("folder", "marketing");
      return (await api.post<Array<{ url: string; publicId: string; width: number; height: number }>>("/media/upload", form)).data[0];
    },
  };
}

export type CmsApi = ReturnType<typeof cmsApi>;
