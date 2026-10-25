import { serializeJsonLd, type JsonLd } from "@/lib/seo";
// [SEOHead · Sprint 7.13]: inserta uno o varios bloques JSON-LD (schema.org) en una página RSC | [Patrón]: Presentational Component | [Principio]: DRY (todas las páginas públicas usan el mismo serializador seguro) | [Paradigma]: Declarativo
// [Nota]: título, descripción y Open Graph van en `generateMetadata` (Metadata API de Next.js); este componente solo aporta los datos estructurados

export function SEOHead({ jsonLd }: { jsonLd: JsonLd | ReadonlyArray<JsonLd> }) {
  const blocks = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
  return (
    <>
      {blocks.map((b, i) => (
        // `dangerouslySetInnerHTML` (React): seguro aquí porque serializeJsonLd escapa `<`
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(b as JsonLd) }} />
      ))}
    </>
  );
}
