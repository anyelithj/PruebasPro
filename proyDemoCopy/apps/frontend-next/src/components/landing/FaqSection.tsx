import type { Dictionary } from "@aula/shared-i18n";
import { faqPageJsonLd } from "@/lib/seo";
import { SEOHead } from "@/components/shared/SEOHead";
// [FaqSection · Sprint 7.13 · RF-84]: preguntas frecuentes de la landing con marcado FAQPage y enlace al Centro de ayuda | [Patrón]: Presentational Component | [Principio]: SSOT (las FAQ públicas de NestJS Help; el diccionario solo es respaldo) | [Paradigma]: Declarativo
// [A11y/Native first]: <details>/<summary> → acordeón accesible por teclado sin JavaScript

export function FaqSection({ l, faqs }: { l: Dictionary["landing"]; faqs: ReadonlyArray<{ q: string; a: string }> }) {
  return (
    <section className="section" id="faq" aria-labelledby="faq-title">
      <SEOHead jsonLd={faqPageJsonLd(faqs)} />
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">{l.faqEyebrow}</span>
          <h2 id="faq-title">{l.faqTitle}</h2>
        </div>
        <div className="mx-auto max-w-3xl space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="feature-card group">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 font-semibold">
                <span>{f.q}</span>
                <span aria-hidden className="transition-transform group-open:rotate-180 motion-reduce:transition-none">▾</span>
              </summary>
              <p className="mt-3">{f.a}</p>
            </details>
          ))}
          {/* /ayuda/faq es PÚBLICA (ANGULAR_PUBLIC_PREFIXES): el visitante la abre sin cuenta */}
          <p className="pt-2 text-center">
            <a href="/ayuda/faq" className="font-semibold text-[var(--primary)] hover:underline">
              {l.faqMore}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
