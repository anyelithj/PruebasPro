// useSEOMeta.ts (Composable + useSeoMeta/useHead de Nuxt) => metadatos SEO de una página en UNA llamada: título,
// descripción, Open Graph / Twitter, URL canónica y JSON-LD (Schema.org). Todo se emite en el SSR: los buscadores y
// las redes lo leen sin ejecutar JavaScript. Patrón Facade (oculta useSeoMeta + useHead) + Adapter (datos -> JSON-LD).
import { computed, type MaybeRefOrGetter, toValue } from "vue";

export interface SeoInput {
  title: string;
  description?: string | null;
  image?: string | null;
  type?: "website" | "article";
  path: string; // Ruta sin idioma (/blog/mi-post): la canónica la arma con siteUrl + prefijo del idioma
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}

export function useSEOMeta(input: MaybeRefOrGetter<SeoInput>) {
  const { public: config } = useRuntimeConfig();
  const localePath = useLocalePath();
  const seo = computed(() => toValue(input));
  const canonical = computed(() => `${config.siteUrl}${localePath(seo.value.path)}`);

  useSeoMeta({
    title: () => seo.value.title,
    description: () => seo.value.description ?? undefined,
    ogTitle: () => seo.value.title,
    ogDescription: () => seo.value.description ?? undefined,
    ogImage: () => seo.value.image ?? undefined,
    ogType: () => seo.value.type ?? "website",
    ogUrl: () => canonical.value,
    twitterCard: () => (seo.value.image ? "summary_large_image" : "summary"),
    robots: () => (seo.value.noindex ? "noindex, nofollow" : "index, follow"),
  });

  useHead(() => ({
    link: [{ rel: "canonical", href: canonical.value }],
    script: seo.value.jsonLd ? [{ type: "application/ld+json", innerHTML: JSON.stringify(seo.value.jsonLd) }] : [],
  }));

  return { canonical };
}

// Crumb => una miga de pan (sin "to" = página actual)
export interface Crumb {
  label: string;
  to?: string;
}

// breadcrumbJsonLd => migas -> BreadcrumbList de Schema.org (función pura, reutilizada por los breadcrumbs)
export function breadcrumbJsonLd(items: Array<{ label: string; url?: string }>): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.label, ...(item.url ? { item: item.url } : {}) })),
  };
}
