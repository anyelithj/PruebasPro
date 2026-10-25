import Link from "next/link";
import type { Dictionary } from "@aula/shared-i18n";
// [Hero · Sprint 7.13]: propuesta de valor + CTA principal de la landing | [Patrón]: Presentational Component (RSC, sin estado) | [Principio]: SRP (antes vivía dentro de app/page.tsx) | [Paradigma]: Declarativo
// [SEO/A11y]: el único <h1> de la página · ilustración decorativa con aria-hidden · [Rendimiento]: SVG inline (sin peticiones ni imágenes)

export function Hero({ l, n }: { l: Dictionary["landing"]; n: Dictionary["publicNav"] }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container hero-grid">
        <div>
          <span className="inline-block rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--primary)]" style={{ marginBottom: 20 }}>
            {l.pill}
          </span>
          <h1 id="hero-title">
            {l.titleA}
            <span className="grad">{l.titleB}</span>
          </h1>
          <p className="lead">{l.lead}</p>
          <div className="hero-cta">
            <Link href="/register?plan=free" className="btn btn-primary">
              {l.start}
            </Link>
            {/* [2026-10-23 · 4.º pase]: «Iniciar sesión» con su color secundario anterior (lila, .btn-outline de landing.css), misma forma que «Comenzar gratis» */}
            <Link href="/login" className="btn btn-outline">
              {n.login}
            </Link>
          </div>
          <div className="hero-stats">
            {l.stats.map((s) => (
              <div key={s.label}>
                <b>{s.value}</b>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="hero-visual" aria-hidden>
          <svg className="brain-svg" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
            <circle cx="200" cy="200" r="160" fill="url(#g1)" opacity="0.12" />
            <circle cx="200" cy="200" r="110" fill="url(#g1)" opacity="0.2" />
            <g stroke="url(#g1)" strokeWidth="2" fill="none" opacity="0.7">
              <path d="M120,180 Q160,120 200,160 T280,180" />
              <path d="M120,220 Q160,280 200,240 T280,220" />
              <path d="M140,160 Q200,200 260,160" />
              <path d="M140,240 Q200,200 260,240" />
            </g>
            <g fill="#6366f1">
              <circle cx="120" cy="180" r="6" />
              <circle cx="200" cy="160" r="8" />
              <circle cx="280" cy="180" r="6" />
              <circle cx="120" cy="220" r="6" />
              <circle cx="200" cy="240" r="8" />
              <circle cx="280" cy="220" r="6" />
              <circle cx="200" cy="200" r="12" fill="#8b5cf6" />
            </g>
          </svg>
          <div className="floating-card fc-1">
            <div className="ic">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <b className="block text-[13px]">{l.card1Title}</b>
              <span className="text-[11px] text-[var(--text-muted)]">{l.card1Sub}</span>
            </div>
          </div>
          <div className="floating-card fc-2">
            <div className="ic">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <b className="block text-[13px]">{l.card2Title}</b>
              <span className="text-[11px] text-[var(--text-muted)]">{l.card2Sub}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
