import "./landing.css";
import { countPublishedByGroup } from "@/lib/courses-api"; // [Facade]: conteo público de cursos por idioma
import { landingFaqs } from "@/lib/help-api"; // [Sprint 7.13]: FAQ públicas de NestJS Help (respaldo: diccionario)
import { organizationJsonLd } from "@/lib/seo";
import { PreferencesProvider } from "@/components/layout/PreferencesProvider"; // [Provider]: tema + idioma también en la landing
import { PublicNavbar } from "@/components/layout/PublicNavbar"; // [Navbar público compartido]: landing + login + registro | [Principio]: DRY
import { SEOHead } from "@/components/shared/SEOHead";
import { CtaFooter } from "@/components/landing/CtaFooter";
import { FaqSection } from "@/components/landing/FaqSection";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LanguagesGrid } from "@/components/landing/LanguagesGrid";
import { LevelsMcer } from "@/components/landing/LevelsMcer";
import { LocalAiPrivacy } from "@/components/landing/LocalAiPrivacy";
import { Pricing } from "@/components/landing/Pricing";
import Link from "next/link";
import { getDictionary } from "@aula/shared-i18n";
import { getLocale } from "@/lib/i18n-server";
// [Landing /]: página pública traducida (ES/EN) compuesta por secciones (Sprint 7.13): hero, idiomas, niveles MCER, características, roles, cómo funciona, IA local, planes, FAQ y CTA | [Patrón]: Composite + Template + Data-driven rendering (textos desde el diccionario) | [Principio]: SRP (una sección por componente) + DRY + OCP | [Tecnología]: React Server Component (HTML completo en servidor → SEO)
// [SEO]: JSON-LD EducationalOrganization + ItemList de Course + FAQPage · [Rendimiento]: sin JS de cliente salvo el navbar; datos en paralelo

// [Iconos de características]: mismo orden que `landing.features` del diccionario | `ReadonlyArray<JSX>` | [Patrón]: Lookup Table
const FEATURE_ICONS = [
  <svg key="0" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M9 11H1l3-3M1 8l3 3M15 13h8l-3 3M23 16l-3-3" />
    <rect x="6" y="3" width="12" height="18" rx="2" />
  </svg>,
  <svg key="1" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>,
  <svg key="2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>,
  <svg key="3" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>,
  <svg key="4" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 9h6v6H9z" />
  </svg>,
  <svg key="5" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>,
];

// `async` (RSC): lee la cookie de idioma → la página se genera ya traducida
export default async function Home() {
  // `Promise.all` (ES2015): idioma, conteo de cursos y FAQ en paralelo (conteo y FAQ nunca lanzan: fail-soft por dentro)
  const locale = await getLocale();
  const [counts, faqs] = await Promise.all([countPublishedByGroup(), landingFaqs(locale)]);
  const d = getDictionary(locale);
  const l = d.landing; // Alias de la sección landing
  const n = d.publicNav;
  // [FAQ]: las públicas del Centro de ayuda; sin backend → las del diccionario
  const faqItems = faqs.length ? faqs.map((f) => ({ q: f.question, a: f.answer })) : l.faqFallback;

  return (
    <PreferencesProvider initialLocale={locale}>
      <SEOHead jsonLd={organizationJsonLd()} />
      {/* [Fuera de .landing-root]: los estilos propios de la landing (.btn, button) no alteran el navbar compartido */}
      <PublicNavbar showSections />
      {/* `id="main-content"`: destino del enlace «Saltar al contenido» del layout raíz (WCAG 2.4.1) */}
      <main id="main-content" tabIndex={-1} className="landing-root outline-none">
        <Hero l={l} n={n} />
        <LanguagesGrid l={l} locale={locale} counts={counts} />
        <LevelsMcer l={l} />
        {/* [Semántica · 2026-10-23 · 4.º pase]: cada <section> se nombra con su <h2> (aria-labelledby) y cada tarjeta es un <article> → esquema de documento claro para SEO y lectores */}
        <section className="section" id="caracteristicas" aria-labelledby="caracteristicas-title">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">{l.featuresEyebrow}</span>
              <h2 id="caracteristicas-title">{l.featuresTitle}</h2>
              <p>{l.featuresLead}</p>
            </div>
            <div className="feature-grid">
              {/* `map` con índice (ES5): icono i ↔ característica i */}
              {l.features.map((f, i) => (
                <article key={f.title} className="feature-card">
                  <div className="icon">{FEATURE_ICONS[i]}</div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="roles" aria-labelledby="roles-title" style={{ background: "var(--bg-alt)" }}>
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">{l.rolesEyebrow}</span>
              <h2 id="roles-title">{l.rolesTitle}</h2>
              <p>{l.rolesLead}</p>
            </div>
            <div className="roles-grid">
              {l.roles.map((r) => (
                <article key={r.badge} className="role-card">
                  <span className="badge">{r.badge}</span>
                  <h3>{r.title}</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>{r.text}</p>
                  <ul>
                    {r.items.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                  <Link href="/login" className="btn btn-primary btn-block">
                    {r.cta}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <HowItWorks l={l} />
        <LocalAiPrivacy l={l} />
        <Pricing l={l} />
        <FaqSection l={l} faqs={faqItems} />
        <CtaFooter l={l} n={n} />
      </main>
    </PreferencesProvider>
  );
}
