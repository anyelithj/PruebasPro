import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "../../landing.css";
import { BRAND } from "@/config/brand";
import { CEFR_LEVELS } from "@/lib/constants";
import { fmt, getDictionary, DEFAULT_LOCALE } from "@aula/shared-i18n";
import { courseListJsonLd } from "@/lib/seo";
import { LANGUAGE_GROUPS, type LanguageGroup } from "@/types/courses";
import { PreferencesProvider } from "@/components/layout/PreferencesProvider";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { SEOHead } from "@/components/shared/SEOHead";
import { CtaFooter } from "@/components/landing/CtaFooter";
// [Página /idiomas/[lang] · Sprint 7.13 · RF-83]: landing propia de cada idioma con metadatos y JSON-LD propios, generada en build (SSG) | [Patrón]: Static Site Generation + Template | [Principio]: DRY (mismos textos y componentes de la landing) + SEO (una URL indexable por idioma) | [Tecnología]: Next.js generateStaticParams + generateMetadata
// [Idioma de la interfaz]: español (por defecto) → HTML 100 % estático y cacheable en CDN; el selector de idioma del navbar sigue disponible

type Params = { lang: string };
const toGroup = (lang: string): LanguageGroup | undefined => LANGUAGE_GROUPS.find((g) => g.toLowerCase() === lang);

// `generateStaticParams` (Next.js): una página por idioma en build → /idiomas/en, /idiomas/fr…
export function generateStaticParams(): Params[] {
  return LANGUAGE_GROUPS.map((g) => ({ lang: g.toLowerCase() }));
}
export const dynamicParams = false; // Otro idioma → 404 sin renderizar

export async function generateMetadata(props: { params: Promise<Params> }): Promise<Metadata> {
  const g = toGroup((await props.params).lang);
  if (!g) return {};
  const l = getDictionary(DEFAULT_LOCALE).landing;
  const name = l.courses[g].name;
  return {
    title: fmt(l.langTitle, { lang: name.toLowerCase() }),
    description: fmt(l.langLead, { lang: name }),
    alternates: { canonical: `/idiomas/${g.toLowerCase()}` },
    openGraph: { title: `${name} · ${BRAND.name}`, description: l.courses[g].text, type: "website" },
  };
}

export default async function LanguagePage(props: { params: Promise<Params> }) {
  const g = toGroup((await props.params).lang);
  if (!g) notFound();
  const d = getDictionary(DEFAULT_LOCALE);
  const l = d.landing;
  const course = l.courses[g];

  return (
    <PreferencesProvider initialLocale={DEFAULT_LOCALE}>
      <SEOHead jsonLd={courseListJsonLd([{ name: course.name, description: course.text }])} />
      <PublicNavbar />
      <main id="main-content" tabIndex={-1} className="landing-root outline-none">
        <section className="hero">
          <div className="container">
            <span className="eyebrow">{g}</span>
            <h1>{fmt(l.langTitle, { lang: course.name.toLowerCase() })}</h1>
            <p className="lead">{course.text}</p>
            <p className="lead">{fmt(l.langLead, { lang: course.name })}</p>
            <div className="hero-cta">
              <Link href={`/courses?chip=${g}`} className="btn btn-primary">
                {l.coursesCta}
              </Link>
              <Link href="/register?plan=free" className="btn btn-outline">
                {l.start}
              </Link>
            </div>
          </div>
        </section>
        <section className="section" aria-labelledby="lang-levels">
          <div className="container">
            <div className="section-head">
              <h2 id="lang-levels">{l.levelsTitle}</h2>
            </div>
            <ol className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {CEFR_LEVELS.map((lvl) => (
                <li key={lvl} className="feature-card">
                  <h3>
                    {course.name} {lvl}
                  </h3>
                  <p>{l.levels[lvl]}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <nav className="section" aria-labelledby="lang-others">
          <div className="container">
            <h2 id="lang-others" className="mb-3 text-lg font-bold">{l.langOthers}</h2>
            <ul className="flex list-none flex-wrap gap-3 p-0">
              {LANGUAGE_GROUPS.filter((o) => o !== g).map((o) => (
                <li key={o}>
                  <Link href={`/idiomas/${o.toLowerCase()}`} className="btn btn-outline">
                    {l.courses[o].name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
        <CtaFooter l={l} n={d.publicNav} />
      </main>
    </PreferencesProvider>
  );
}
