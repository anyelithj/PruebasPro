import { BRAND } from "@/config/brand";
// [seo · Sprint 7.13]: constructores de datos estructurados schema.org (JSON-LD) para la landing y las páginas por idioma | [Patrón]: Builder (funciones puras) | [Principio]: DRY (un solo lugar para el marcado) + SRP | [Paradigma]: Funcional
// [Uso]: el resultado se pinta con <SEOHead jsonLd={…}/> (components/shared/SEOHead.tsx)

export type JsonLd = Record<string, unknown>;

// [organization]: quién publica (Google lo usa para el panel de la marca)
export const organizationJsonLd = (): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: BRAND.name,
  email: BRAND.supportEmail,
});

// [courseListJsonLd]: ItemList de Course → resultados enriquecidos de cursos
export const courseListJsonLd = (courses: ReadonlyArray<{ name: string; description: string }>): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: courses.map((c, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: { "@type": "Course", name: c.name, description: c.description, provider: { "@type": "Organization", name: BRAND.name } },
  })),
});

// [faqPageJsonLd]: FAQPage → las preguntas pueden aparecer desplegables en el buscador
export const faqPageJsonLd = (faqs: ReadonlyArray<{ q: string; a: string }>): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
});

// [serializeJsonLd]: JSON seguro dentro de <script> — `<` escapado para que un texto con «</script>» no cierre la etiqueta (inyección HTML)
export const serializeJsonLd = (data: JsonLd): string => JSON.stringify(data).replace(/</g, "\\u003c");
