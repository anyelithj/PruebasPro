import Link from "next/link";
import { BRAND } from "@/config/brand";
import { fmt, type Dictionary } from "@aula/shared-i18n";
// [CtaFooter · Sprint 7.13]: llamada final a la acción + pie con enlaces de producto, cuenta, ayuda y legales | [Patrón]: Presentational Component | [Principio]: SRP (antes inline en app/page.tsx) | [Paradigma]: Declarativo
// [A11y]: <footer> con encabezados de grupo <h3> (siguen al <h2> del CTA: sin saltos de nivel) · enlaces con texto · `id="contacto"` = ancla del navbar

export function CtaFooter({ l, n }: { l: Dictionary["landing"]; n: Dictionary["publicNav"] }) {
  const year = new Date().getFullYear();
  return (
    <>
      {/* [2026-10-23 · 4.º pase]: <section> con encabezado asociado (semántica + SEO) dentro de .container → alineada con el navbar */}
      <section className="container cta-wrap" aria-labelledby="cta-title">
        <div className="cta-section">
          <h2 id="cta-title">{fmt(l.ctaTitle, { brand: BRAND.name })}</h2>
          <p>{l.ctaText}</p>
          <Link href="/register?plan=free" className="btn btn-primary">
            {l.ctaButton}
          </Link>
        </div>
      </section>
      <footer className="footer" id="contacto">
        <div className="container">
          <div className="footer-grid">
            <div>
              <div className="brand mb-3.5 text-white">
                <span className="brand-mark" aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M12 2a3 3 0 0 0-3 3 3 3 0 0 0-3 3 3 3 0 0 0 0 6 3 3 0 0 0 3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0 3-3 3 3 0 0 0 0-6 3 3 0 0 0-3-3 3 3 0 0 0-3-3z" />
                  </svg>
                </span>
                <span className="text-white">{BRAND.name}</span>
              </div>
              <p className="max-w-[300px] text-sm text-slate-400">{l.footerAbout}</p>
            </div>
            <div>
              <h3>{l.footerProduct}</h3>
              <a href="#cursos">{n.courses}</a>
              <a href="#niveles">{n.levels}</a>
              <a href="#planes">{n.pricing}</a>
              <a href="#faq">{n.faq}</a>
            </div>
            <div>
              <h3>{l.footerAccount}</h3>
              <Link href="/login">{n.login}</Link>
              <Link href="/register">{n.register}</Link>
              <a href="/verificar">{l.verifyCertificate}</a>
            </div>
            <div>
              <h3>{l.footerContact}</h3>
              <a href="/ayuda/faq">{n.faq}</a>
              <Link href="/terms">{l.terms}</Link>
              <span>{BRAND.supportEmail}</span>
            </div>
          </div>
          <div className="footer-bottom">
            © <span>{year}</span> {BRAND.name}. {l.footerRights}
          </div>
        </div>
      </footer>
    </>
  );
}
