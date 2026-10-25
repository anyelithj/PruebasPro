import Link from "next/link";
import { CEFR_LEVELS } from "@/lib/constants"; // [SSOT niveles MCER]: A1–C2
import { plural, type Dictionary, type Locale } from "@aula/shared-i18n";
import { courseListJsonLd } from "@/lib/seo";
import { LANGUAGE_GROUPS, type LanguageGroup } from "@/types/courses"; // [SSOT]: mismos 7 idiomas y orden que el catálogo
import { SEOHead } from "@/components/shared/SEOHead";
// [LanguagesGrid · Sprint 7.13]: los siete idiomas con su conteo de cursos publicados y enlace a su página propia (/idiomas/[lang]) | [Patrón]: Presentational Component + Data-driven rendering | [Principio]: SRP + DRY (mismas tarjetas `feature-card` que el resto de la landing) | [Paradigma]: Declarativo
// [SEO]: ItemList de Course (JSON-LD) · [A11y]: <ul> semántico («lista, 7 elementos») y enlaces con nombre por idioma

export function LanguagesGrid({ l, locale, counts }: { l: Dictionary["landing"]; locale: Locale; counts: Partial<Record<LanguageGroup, number>> }) {
  return (
    <section className="section" id="cursos" aria-labelledby="cursos-title">
      <SEOHead jsonLd={courseListJsonLd(LANGUAGE_GROUPS.map((g) => ({ name: l.courses[g].name, description: l.courses[g].text })))} />
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">{l.coursesEyebrow}</span>
          <h2 id="cursos-title">{l.coursesTitle}</h2>
          <p>{l.coursesLead}</p>
        </div>
        <ul className="feature-grid course-list">
          {LANGUAGE_GROUPS.map((g) => {
            const course = l.courses[g];
            const total = counts[g]; // `undefined` si el backend no respondió → no se muestra conteo
            return (
              <li key={g} className="feature-card course-card">
                <div className="course-head">
                  <div className="icon" aria-hidden>
                    <b>{g}</b>
                  </div>
                  <div>
                    <h3>
                      {/* [Página por idioma · SSG]: contenido indexable propio para cada idioma */}
                      <Link href={`/idiomas/${g.toLowerCase()}`} className="hover:underline">
                        {course.name}
                      </Link>
                    </h3>
                    <span className="course-meta" title={l.coursesLevels}>
                      {CEFR_LEVELS[0]}–{CEFR_LEVELS[CEFR_LEVELS.length - 1]}
                      {total !== undefined && ` · ${plural(locale, total, l.coursesCount)}`}
                    </span>
                  </div>
                </div>
                <p>{course.text}</p>
                {/* `?chip=` = filtro por idioma del catálogo; sin sesión el proxy lleva a /login */}
                <Link href={`/courses?chip=${g}`} className="btn btn-primary btn-block course-btn" aria-label={`${l.coursesCta}: ${course.name}`}>
                  {l.coursesCta}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
