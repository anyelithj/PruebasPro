// blog.types.ts (TypeScript estricto) => entradas del blog (Nuxt Content: archivos MDC en content/blog) y eventos SEO
// (Express /cms/event). Value Objects de solo lectura para las vistas.
import type { CmsContent, CmsContentSummary } from "../../cms/model/cms.types";

// BlogPost => frontmatter + metadatos que Nuxt Content agrega (path = URL, description)
export interface BlogPost {
  path: string;
  title: string;
  description: string;
  date: string;
  author: string;
  category: string;
  tags: string[];
  image?: string;
  imageAlt?: string;
  locale: "es" | "en";
}

// EventData => "data" de un evento SEO (schema.org Event)
export interface EventData {
  startsAt: string;
  endsAt: string;
  location: string;
  online: boolean;
  url?: string;
}

export type SeoEvent = CmsContent<EventData>;
export type SeoEventSummary = CmsContentSummary<EventData>;

// CategoryNode => árbol de categorías del catálogo (Express /category)
export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  productCount: number;
  children: CategoryNode[];
}

export interface CategoryDetail extends CategoryNode {
  breadcrumb: Array<{ id: string; name: string; slug: string }>;
}
